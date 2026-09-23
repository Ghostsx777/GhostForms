# Publicação gratuita: Render + Neon

## Estado

Código preparado. A publicação só estará concluída depois de criar os serviços,
configurar as credenciais e validar o endereço público. O GitHub armazena o código;
GitHub Pages não executa o servidor deste projeto.

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
