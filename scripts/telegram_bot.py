"""Telegram controller, executed periodically by GitHub Actions. No dependencies."""
import copy
from datetime import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from zoneinfo import ZoneInfo
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
STATE = '.github/telegram-state.json'
HELP = (
    'Central de links\n\n'
    '/listar — ver links soltos e pastas\n'
    '/pastas — ver as pastas\n'
    '/pasta Trans — ver os links de uma pasta\n'
    '/link hubTS — copiar o link fixo\n'
    '/criar nome https://t.me/SeuBot — criar um link\n'
    '/criarpasta Trans nome https://t.me/SeuBot — criar dentro da pasta\n'
    '/destino hubTS https://t.me/NovoDestino — trocar um destino\n'
    '/destinopasta Trans https://t.me/NovoDestino — trocar todos da pasta\n'
    '/trafego Trans hoje — acessos de hoje\n'
    '/ranking Trans 7d — ranking dos últimos 7 dias\n\n'
    'Os nomes diferenciam maiúsculas de minúsculas. '
    'Consultas programadas a cada 5 minutos, sujeitas a atrasos. '
    'Depois de uma alteração, aguarde a confirmação da publicação no canal. '
    'Este controle ainda não detecta bots removidos.'
)


class SafeError(Exception):
    pass


def valid_destination(value):
    if len(value) > 2048 or any(char.isspace() or ord(char) < 32 for char in value):
        return False
    try:
        url = urlsplit(value)
        return (url.scheme == 'https' and url.netloc == 't.me'
                and url.path not in ('', '/') and '\\' not in value)
    except ValueError:
        return False


def authorized(message, admin_id):
    return (message.get('chat', {}).get('type') == 'private'
            and str(message.get('from', {}).get('id')) == str(admin_id)
            and str(message.get('chat', {}).get('id')) == str(admin_id))


def public_link(base, name):
    return base + '?' + urlencode({'bot': name})


def command(config, text, base, bot_username):
    """Return a new config and reply; never mutate caller state."""
    result = copy.deepcopy(config)
    destinations = result['destinos']
    groups = result.get('grupos', {})
    parts = text.split()
    if not parts:
        return result, HELP
    name, _, mention = parts[0].partition('@')
    if mention and mention.lower() != bot_username.lower():
        return result, None
    name = name.lower()
    if name in ('/start', '/ajuda', '/help'):
        return result, HELP
    if name in ('/listar', '/pastas'):
        grouped = {key for members in groups.values() if isinstance(members, list) for key in members}
        folder_rows = [f'{folder} ({len([key for key in members if key in destinations])} links)'
                       for folder, members in sorted(groups.items()) if isinstance(members, list)]
        if name == '/pastas':
            return result, ('Pastas:\n' + '\n'.join(folder_rows)) if folder_rows else 'Nenhuma pasta cadastrada.'
        loose = [f'{key}\n{url}\n{public_link(base, key)}'
                 for key, url in sorted(destinations.items()) if key not in grouped]
        sections = []
        if loose:
            sections.append('Links sem pasta:\n\n' + '\n\n'.join(loose))
        if folder_rows:
            sections.append('Pastas:\n' + '\n'.join(folder_rows)
                            + '\n\nUse /pasta NOME para abrir uma pasta.')
        return result, '\n\n'.join(sections) if sections else 'Nenhum destino cadastrado. Use /criar.'
    if name == '/pasta' and len(parts) == 2:
        folder = parts[1]
        if folder not in groups or not isinstance(groups[folder], list):
            return result, 'Pasta não cadastrada. Use /pastas.'
        rows = [f'{key}\n{public_link(base, key)}' for key in groups[folder] if key in destinations]
        return result, (f'Pasta {folder} ({len(rows)} links):\n\n' + '\n\n'.join(rows))
    if name == '/destinopasta':
        if len(parts) != 3:
            return result, 'Use: /destinopasta pasta https://t.me/NovoDestino'
        folder, destination = parts[1:]
        if folder not in groups or not isinstance(groups[folder], list):
            return result, 'Pasta não cadastrada. Use /pastas.'
        if not valid_destination(destination):
            return result, 'Destino inválido. Use um endereço completo https://t.me/ de bot, canal ou convite.'
        members = [key for key in groups[folder] if key in destinations]
        if not members:
            return result, 'Essa pasta não possui links válidos.'
        if all(destinations[key] == destination for key in members):
            return result, 'Todos os links dessa pasta já usam esse destino.'
        for key in members:
            destinations[key] = destination
        return result, (f'Destino atualizado para os {len(members)} links da pasta {folder}.\n'
                        'Aguarde a confirmação de publicação no canal antes de testar.')
    if name == '/criarpasta':
        if len(parts) != 4:
            return result, 'Use: /criarpasta pasta nome https://t.me/SeuDestino'
        folder, key, destination = parts[1:]
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', folder):
            return result, 'Nome da pasta inválido. Use até 64 letras sem acentos, números, hífen ou sublinhado.'
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', key):
            return result, 'Nome inválido. Use até 64 letras sem acentos, números, hífen ou sublinhado.'
        if not valid_destination(destination):
            return result, 'Destino inválido. Use um endereço completo https://t.me/ de bot, canal ou convite.'
        if key in destinations:
            return result, 'Esse nome já existe. Para alterar, use /destino.'
        destinations[key] = destination
        groups = result.setdefault('grupos', {})
        groups.setdefault(folder, []).append(key)
        return result, (f'Link {key} criado na pasta {folder}.\n' + public_link(base, key)
                        + '\nAguarde a confirmação de publicação no canal antes de testar.')
    if name == '/link' and len(parts) == 2:
        return result, public_link(base, parts[1]) if parts[1] in destinations else 'Nome não cadastrado. Use /listar.'
    if name not in ('/criar', '/destino'):
        return result, 'Comando não reconhecido.\n\n' + HELP
    if len(parts) != 3:
        return result, f'Use: {name} nome https://t.me/SeuDestino'
    key, destination = parts[1:]
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,64}', key):
        return result, 'Nome inválido. Use até 64 letras sem acentos, números, hífen ou sublinhado.'
    if not valid_destination(destination):
        return result, 'Destino inválido. Use um endereço completo https://t.me/ de bot, canal ou convite.'
    if name == '/criar' and key in destinations:
        return result, 'Esse nome já existe. Para alterar, use /destino.'
    if name == '/destino' and key not in destinations:
        return result, 'Esse nome não existe. Para cadastrar, use /criar.'
    if destinations.get(key) == destination:
        return result, 'Esse destino já está cadastrado.\n' + public_link(base, key)
    destinations[key] = destination
    return result, ('Configuração salva para ' + key + '.\n' + public_link(base, key)
                    + '\nAguarde a confirmação de publicação no canal antes de testar.')


def telegram(method, body=None):
    token = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not token:
        raise SafeError('Falta o Secret TELEGRAM_BOT_TOKEN.')
    request = Request('https://api.telegram.org/bot' + token + '/' + method,
                      data=json.dumps(body or {}).encode(),
                      headers={'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=25) as response:
            result = json.load(response)
    except HTTPError as error:
        raise SafeError(f'Telegram: HTTP {error.code} em {method}. Verifique o token e as permissões.') from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise SafeError(f'Falha de conexão ou resposta em {method}.') from None
    if not result.get('ok'):
        raise SafeError(f'Telegram não confirmou {method}.')
    return result['result']


def send(chat_id, text):
    # Conservative chunk size also accommodates Telegram's UTF-16 limits.
    for start in range(0, len(text), 1800):
        telegram('sendMessage', {'chat_id': chat_id, 'text': text[start:start+1800],
                                'link_preview_options': {'is_disabled': True}})


def fetch_metrics(period):
    base = os.environ.get('METRICS_API_URL', '').strip().rstrip('/')
    token = os.environ.get('METRICS_API_TOKEN', '').strip()
    try:
        parsed = urlsplit(base)
    except ValueError:
        parsed = None
    if not base or not token or not parsed or parsed.scheme != 'https' or not parsed.netloc:
        raise SafeError('As métricas ainda não foram ativadas.')
    request = Request(base + '/stats?' + urlencode({'period': period}),
                      headers={'Authorization': 'Bearer ' + token})
    try:
        with urlopen(request, timeout=20) as response:
            result = json.load(response)
    except HTTPError as error:
        raise SafeError(f'Métricas: HTTP {error.code}. Confira os Secrets.') from None
    except (URLError, TimeoutError, OSError, ValueError):
        raise SafeError('Não foi possível consultar as métricas agora.') from None
    if not result.get('ok') or not isinstance(result.get('counts'), list):
        raise SafeError('A API de métricas retornou uma resposta inválida.')
    return {str(row.get('bot')): int(row.get('clicks', 0)) for row in result['counts']}


def traffic_reply(config, text, bot_username, provider=fetch_metrics):
    parts = text.split()
    if not parts:
        return None
    name, _, mention = parts[0].partition('@')
    if mention and mention.lower() != bot_username.lower():
        return None
    name = name.lower()
    if name not in ('/trafego', '/ranking'):
        return None
    if len(parts) not in (2, 3):
        return ('Use: /trafego nome hoje\n'
                'ou: /ranking pasta 7d')
    target = parts[1]
    period_input = parts[2].lower() if len(parts) == 3 else 'hoje'
    periods = {'hoje': ('today', 'hoje'), 'today': ('today', 'hoje'),
               '7d': ('7d', 'últimos 7 dias'), '30d': ('30d', 'últimos 30 dias')}
    if period_input not in periods:
        return 'Período inválido. Use hoje, 7d ou 30d.'
    period, label = periods[period_input]
    groups = config.get('grupos', {})
    destinations = config.get('destinos', {})
    if target in groups and isinstance(groups[target], list):
        members = [key for key in groups[target] if key in destinations]
        title = f'Pasta {target} — {label}'
    elif target in destinations and name == '/trafego':
        members = [target]
        title = f'{target} — {label}'
    else:
        return 'Link ou pasta não cadastrado. Use /listar ou /pastas.'
    counts = provider(period)
    rows = sorted(((key, max(0, counts.get(key, 0))) for key in members),
                  key=lambda item: (-item[1], item[0].lower()))
    total = sum(value for _, value in rows)
    if len(rows) == 1:
        return f'{title}\n\nVocê teve {total:,} acessos 🤩🎉'.replace(',', '.')
    ranking = '\n'.join(
        f'{index}. {key}: {value:,} acessos'.replace(',', '.')
        for index, (key, value) in enumerate(rows, 1)
    )
    return (f'{title}\n\n{ranking}\n\n'
            f'Total: {total:,} acessos 🤩🎉').replace(',', '.')


def daily_report(config, folder, counts):
    members = config.get('grupos', {}).get(folder, [])
    rows = sorted(((key, max(0, counts.get(key, 0))) for key in members),
                  key=lambda item: (-item[1], item[0].lower()))
    total = sum(value for _, value in rows)
    if not total:
        return f'Relatório diário — Pasta {folder}\n\nHoje não houve acessos registrados.'
    ranking = '\n'.join(
        f'{index}. {key}: {value:,} acessos'.replace(',', '.')
        for index, (key, value) in enumerate(rows[:10], 1) if value > 0
    )
    return (f'Relatório diário — Pasta {folder} 🎉\n\n'
            f'Você teve {total:,} acessos hoje 🤩\n\n'
            f'{ranking}\n\nTotal: {total:,} acessos').replace(',', '.')


def read_json(relative, default=None):
    path = ROOT / relative
    if not path.exists() and default is not None:
        return default
    return json.loads(path.read_text(encoding='utf-8-sig'))


def write_json(relative, value):
    path = ROOT / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def git(*args):
    process = subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True)
    if process.returncode:
        raise SafeError('Falha ao salvar/enviar no GitHub. Verifique permissão de escrita e alterações concorrentes. Nenhum envio forçado foi feito.')
    return process.stdout.strip()


def persist(config, state, message):
    write_json('config.json', config)
    write_json(STATE, state)
    git('config', 'user.name', 'github-actions[bot]')
    git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com')
    git('add', 'config.json', STATE)
    if git('diff', '--cached', '--name-only'):
        git('commit', '-m', message)
        git('push', 'origin', 'HEAD:main')


def output(key, value):
    filename = os.environ.get('GITHUB_OUTPUT')
    if filename:
        with open(filename, 'a', encoding='utf-8') as handle:
            handle.write(f'{key}={str(value).lower()}\n')


def process():
    required = ('TELEGRAM_BOT_TOKEN', 'TELEGRAM_ADMIN_ID', 'TELEGRAM_CHANNEL_ID')
    if any(not os.environ.get(key) for key in required):
        raise SafeError('Configure os três Secrets do Telegram antes de ativar o controle.')
    admin = os.environ['TELEGRAM_ADMIN_ID'].strip()
    if not re.fullmatch(r'[1-9][0-9]*', admin):
        raise SafeError('TELEGRAM_ADMIN_ID deve conter o ID numérico da conta administradora.')
    if telegram('getWebhookInfo').get('url'):
        raise SafeError('Existe um webhook ativo. Desconecte o outro serviço antes de usar este controle.')
    bot_username = telegram('getMe')['username']
    config = read_json('config.json')
    if not isinstance(config.get('destinos'), dict):
        raise SafeError('config.json deve conter um objeto destinos.')
    state = read_json(STATE, {'offset': 0, 'pending_deploy': False})
    updates = telegram('getUpdates', {'offset': state['offset'], 'timeout': 0,
                                      'limit': 100, 'allowed_updates': ['message']})
    initial = copy.deepcopy(config)
    replies = []
    accepted = 0
    rejected_private = 0
    for update in updates:
        if update['update_id'] < state['offset']:
            continue
        message = update.get('message', {})
        if authorized(message, admin):
            accepted += 1
            text = message.get('text', '')
            try:
                reply = traffic_reply(config, text, bot_username)
            except SafeError as error:
                reply = str(error)
            if reply is None:
                config, reply = command(config, text,
                                        os.environ['PUBLIC_BASE_URL'], bot_username)
            if reply:
                replies.append(reply)
        elif message.get('chat', {}).get('type') == 'private':
            rejected_private += 1
        state['offset'] = update['update_id'] + 1
    changed = config != initial
    state['pending_deploy'] = bool(state.get('pending_deploy') or changed)
    # Commit the cursor with the change before confirming anything to the user.
    # If push fails, messages remain unacknowledged and can be retried safely.
    if updates:
        persist(config, state, 'Atualiza central pelo Telegram' if changed else 'Registra comandos processados')
    output('deploy', state['pending_deploy'])
    print(f'Mensagens recebidas: {len(updates)}; autorizadas: {accepted}; privadas sem autorização: {rejected_private}.')
    if rejected_private and not accepted:
        print('::warning::Nenhuma mensagem privada veio do administrador configurado. Confira TELEGRAM_ADMIN_ID: deve ser o ID pessoal, não o ID do bot nem do canal. Após corrigir, envie um NOVO /start.')
    failed_replies = False
    for reply in replies:
        try:
            send(admin, reply)
        except SafeError:
            failed_replies = True
    if failed_replies:
        # Do not prevent publishing a change that was already saved.
        print('::warning::Comandos salvos, mas uma resposta privada falhou. Consulte /listar após corrigir o acesso ao bot.')
    now = datetime.now(ZoneInfo('America/Sao_Paulo'))
    today = now.date().isoformat()
    metrics_ready = bool(os.environ.get('METRICS_API_URL') and os.environ.get('METRICS_API_TOKEN'))
    if (metrics_ready and (now.hour, now.minute) >= (23, 50)
            and state.get('last_daily_report') != today):
        try:
            report = daily_report(config, 'Trans', fetch_metrics('today'))
            send(os.environ['TELEGRAM_CHANNEL_ID'], report)
            state['last_daily_report'] = today
            persist(config, state, 'Registra relatório diário de acessos')
        except SafeError:
            print('::warning::Não foi possível enviar o relatório diário de acessos.')


def complete():
    state = read_json(STATE, {'offset': 0, 'pending_deploy': False})
    if state.get('pending_deploy'):
        state['pending_deploy'] = False
        persist(read_json('config.json'), state, 'Confirma publicação da central')
    send(os.environ['TELEGRAM_CHANNEL_ID'],
         'Central de links publicada com sucesso.\n' + os.environ['PUBLIC_BASE_URL']
         + '\nUse /listar ou /link no privado para consultar seus links.')


def failure():
    if os.environ.get('TELEGRAM_BOT_TOKEN') and os.environ.get('TELEGRAM_CHANNEL_ID'):
        repo = os.environ.get('GITHUB_REPOSITORY', '')
        run = os.environ.get('GITHUB_RUN_ID', '')
        send(os.environ['TELEGRAM_CHANNEL_ID'], 'Falha na execução da central de links. '
             'A alteração pode ter sido salva sem concluir a publicação. Confira:\n'
             + f'https://github.com/{repo}/actions/runs/{run}')


if __name__ == '__main__':
    try:
        action = sys.argv[1] if len(sys.argv) > 1 else 'process'
        {'process': process, 'complete': complete, 'failure': failure}[action]()
    except SafeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Never print exceptions that could contain API URLs or credentials.
        print('Erro interno. Confira a configuração e execute os testes.', file=sys.stderr)
        sys.exit(1)
