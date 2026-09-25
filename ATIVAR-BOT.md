# Ativar o controle pelo Telegram

Os arquivos da integração ficam no repositório local `telelink`. O bot só entra em funcionamento depois de enviar esses arquivos, cadastrar os Secrets e mudar a publicação para GitHub Actions.

## 1. Enviar a atualização

No GitHub Desktop, selecione **telelink**, salve as alterações se necessário e clique em **Push origin**.

## 2. Configurar os Secrets

Abra https://github.com/tstwitter/telelink/settings/secrets/actions e use **New repository secret** para cada item:

| Nome | Valor |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Token do @managerseo3_bot fornecido pelo BotFather |
| `TELEGRAM_ADMIN_ID` | ID numérico da sua conta administradora, informado na conversa |
| `TELEGRAM_CHANNEL_ID` | ID numérico do canal de avisos, informado na conversa |

Não salve o token em arquivos do repositório. O bot deve ser administrador do canal com permissão de publicar. O serviço de SEO anterior deve estar desconectado deste bot: só esta integração deve consumir suas mensagens.

## 3. Mudar a publicação

Em https://github.com/tstwitter/telelink/settings/pages, altere **Source** para **GitHub Actions**. Isso permite publicar as alterações feitas pelo próprio bot. A publicação antiga por branch não é suficiente para commits feitos com o token automático do GitHub.

Em Settings → Actions → General, verifique se Actions está permitido. A automação declara permissão para gravar no próprio repositório e publicar o Pages; regras que proíbam essas permissões ou exijam revisão de cada commit podem impedir os comandos.

## 4. Testar

Abra https://github.com/tstwitter/telelink/actions e escolha **Central de links → Run workflow → main → Run workflow**. Depois envie `/start` ou `/listar` no privado do bot. Você pode executar a automação manualmente novamente para processar sem esperar a consulta agendada.

Confirme que a execução terminou verde, que a resposta chegou no privado e que a publicação foi avisada no canal. Teste o link https://tstwitter.github.io/telelink/?bot=hubTS .

## Comandos

```text
/start
/listar
/link hubTS
/criar nome https://t.me/SeuBot
/destino hubTS https://t.me/NovoDestino
```

Os dois últimos são exemplos: substitua pelo destino real. `/criar` não sobrescreve nomes existentes; `/destino` exige um nome já cadastrado. Somente mensagens privadas vindas do ID administrador são aceitas. Os nomes diferenciam maiúsculas de minúsculas.

## Funcionamento e limites

- Há uma consulta programada a cada cinco minutos; o GitHub pode atrasar ou descartar execuções em períodos de carga. Não é resposta instantânea.
- O bot confirma a gravação antes da publicação; espere o aviso de publicação concluída no canal. Se falhar, consulte Actions. Publicações pendentes são tentadas nas próximas execuções.
- A programação pode ser desativada pelo GitHub após 60 dias sem atividade no repositório. Reative em Actions quando necessário. O Telegram mantém mensagens pendentes por até 24 horas; comandos muito antigos podem expirar.
- O estado guarda apenas o cursor dos comandos e se há publicação pendente, sem tokens, texto das mensagens ou IDs pessoais. Apenas os quatro arquivos do site são enviados ao Pages.
- Não há aviso a cada consulta sem alteração. Publicações concluídas e falhas geram aviso. Falhas ao enviar uma resposta privada são registradas na execução; a resposta não é reenviada automaticamente para evitar repetir alterações.
- Detecção de bots removidos ainda não está implementada. O destino atual hubTS é um convite, não um @ de bot; ele exige outra forma de verificação. Este recurso gerencia os links e avisa sobre publicações e falhas da automação.
- Após o bot mudar arquivos, use **Fetch/Pull origin** no GitHub Desktop antes de fazer alterações locais.

Referências: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule e https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
