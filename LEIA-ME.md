# Central de links

Edite config.json com os destinos reais, por exemplo:

```json
{
  "destinos": {
    "loiras": "https://t.me/PrimeiroBot",
    "morenas": "https://t.me/SegundoBot"
  },
  "enviarOrigemAoBot": false
}
```

Use https://tstwitter.github.io/telelink/?bot=hubTS (exemplo, ainda não publicado). Para trocar o bot, altere somente o endereço correspondente ao nome. Para adicionar outro, acrescente uma entrada. Nomes aceitam letras maiúsculas ou minúsculas sem acentos, números, hífen e sublinhado, até 64 caracteres.

O destino hubTS está cadastrado. Os nomes diferenciam maiúsculas de minúsculas. Nomes desconhecidos não redirecionam. Nunca coloque tokens ou senhas neste arquivo público.

## Publicar

Envie index.html, redirect.js, config.json e .nojekyll para a raiz do repositório. Em Settings → Pages, escolha Deploy from a branch, main, /(root), Save. Aguarde a publicação e teste o endereço mostrado com ?bot=loiras (ou um nome cadastrado).

Mudanças passam a valer após publicação e propagação dos caches. A configuração é consultada a cada visita com cache desabilitado. Mantenha usuário e nome do repositório para preservar o endereço.

## Redirecionamento e origens

O redirecionamento é automático após carregar a configuração. O botão é uma alternativa caso o navegador bloqueie a navegação. JavaScript é necessário. Em falhas, não usa destinos antigos. Aceita somente HTTPS no domínio exato t.me, incluindo convites e parâmetros existentes.

Use ?bot=loiras&src=twitter01. Esta versão não conta nem armazena cliques. Opcionalmente, enviarOrigemAoBot: true transforma src em start para destinos cujo nome termine em bot, sem substituir start existente. O bot precisa registrar o comando para medir origens. Convites e canais não recebem start.

## Controle pelo Telegram e alertas

Ainda não implementados. O bot de avisos foi testado separadamente, mas a página estática não recebe comandos nem monitora o Telegram. Essa integração precisa de um serviço, credenciais privadas e identificação do administrador autorizado. Nunca exponha tokens no repositório ou na página.

## Verificação

Após publicar, teste cada nome, uma origem src e uma troca de destino, incluindo o navegador interno do X. Um nome desconhecido deve mostrar indisponibilidade.

Referências: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site e https://core.telegram.org/bots/features#deep-linking


