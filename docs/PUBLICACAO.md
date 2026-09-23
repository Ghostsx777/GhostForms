# Publicação gratuita: Render + Neon

## Estado

Publicado em https://ghostforms-ghostsx777.onrender.com.
Administração: https://ghostforms-ghostsx777.onrender.com/master-admin.
Use o mesmo e-mail e senha da conta master local.

Foram migradas 3 contas, 1 formulário e seu histórico. O formulário existente
continua como rascunho: publique-o no editor antes de compartilhar o link.
As 94 verificações HTTP passaram no PostgreSQL online, incluindo permissões,
cadastro pendente, aprovação, formulários, imagens, respostas e moderação.
O GitHub armazena o código; o Render executa o site e o Neon mantém o banco.

## Configuração

1. Entre no Neon com a conta do projeto. Crie um projeto gratuito `GhostForms`,
   PostgreSQL na região AWS US East (N. Virginia), e guarde a conexão PostgreSQL
   com TLS. Não coloque essa conexão no GitHub.
2. No Render, conectado com Ghostsx777, crie um Blueprint apontando para
   `https://github.com/Ghostsx777/GhostForms`. O arquivo `render.yaml` seleciona
   explicitamente o plano **free**. Não adicione serviços pagos nem cartão.
3. Informe a conexão do Neon em `DATABASE_URL` como variável secreta.
4. O Render fornece uma URL HTTPS e `RENDER_EXTERNAL_URL`. O script de inicialização
   usa essa origem para proteger login e envio de formulários. Se houver domínio
   próprio, defina `APP_URL` com sua origem HTTPS exata.
5. A compilação executa `build:cloud`; a inicialização executa `start:cloud`,
   aplica somente as migrações PostgreSQL e inicia na porta fornecida pelo Render.
6. Antes de divulgar o endereço, migre o banco local ou crie um administrador
   com `scripts/create-admin.ts`, usando variáveis temporárias de ambiente.

## Banco e desenvolvimento local

`prisma/schema.prisma` e suas migrações continuam sendo SQLite. O comando
`node scripts/cloud-schema.mjs` gera o mesmo modelo em
`prisma/postgresql/schema.prisma`. As migrações PostgreSQL ficam em uma pasta
separada. Alterações futuras no modelo precisam de migração para os dois bancos.

`build:cloud` gera o cliente PostgreSQL; `npm run db:generate` restaura o cliente
SQLite. Pare o servidor local antes de trocar o cliente no Windows. Não execute
o servidor local com o cliente PostgreSQL e uma conexão `file:`.

Para copiar os dados atuais, use uma cópia isolada do projeto com o cliente
PostgreSQL gerado. Configure `DATABASE_URL` do destino e `SOURCE_SQLITE` com o
caminho absoluto do banco local; execute `node scripts/import-cloud.mjs`.
O script lê uma fotografia consistente do SQLite, preserva IDs, links, hashes de
senha, formulários, imagens e respostas, e recusa um destino não vazio.
Sessões e contadores locais não são migrados. A operação é transacional.
Não há sincronização automática: depois da migração, use a versão online.

### Importação pelo painel do Render

Quando a conexão fica apenas no Render, execute localmente
`node scripts/export-cloud.mjs`. O arquivo privado
`test-results/.env.cloud-import` contém a fotografia das tabelas necessárias,
incluindo hashes de senha, e é ignorado pelo Git. Ele não contém sessões.
No Render, em **Environment → Edit → Import from .env → Choose a file**, importe
esse arquivo. Não o compartilhe nem o adicione ao repositório.

No próximo deploy, a inicialização importa os dados em uma transação, confere
as contagens e registra um comprovante que impede repetir a mesma importação.
Um destino com outros dados é recusado. O código não sobrescreve contas existentes.
`GHOSTFORMS_VERIFY_DEPLOY=1` também executa a suíte HTTP através do endereço interno
do serviço, usando contas temporárias removidas ao fim dos testes.

Após confirmar o sucesso nos logs, remova `GHOSTFORMS_IMPORT_DATA` e defina
`GHOSTFORMS_VERIFY_DEPLOY=0` no Render. Remova o arquivo temporário local.
Essas opções são usadas apenas durante a migração inicial.

## Validação antes de anunciar a URL

- `/api/health` deve retornar HTTP 200 com `status: ok`.
- Login master, cadastro pendente e aprovação devem funcionar no domínio HTTPS.
- Um formulário publicado deve abrir sem login, receber uma resposta e permitir moderação.
- Capas devem continuar disponíveis depois de reiniciar o serviço (são armazenadas no Neon).
- Formulários privados, contas e respostas administrativas não podem ser acessados anonimamente.

## Limites

O plano gratuito do Render suspende o processo após inatividade; a primeira visita
pode demorar cerca de um minuto. Render e Neon têm limites de uso gratuitos.
Não há garantia de disponibilidade permanente. Não configure rotinas para evitar
a suspensão. O banco não fica no disco temporário do Render.

Fontes: https://render.com/docs/free e https://render.com/docs/deploy-nextjs-app.
