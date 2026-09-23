# GhostForms

Base full-stack executável para criar formulários com identidade escura, contas aprovadas manualmente e moderação de respostas. Next.js App Router + React + TypeScript + Tailwind CSS 4 + Prisma + SQLite. O backend é real: os dados não ficam em localStorage e os controles de acesso são verificados no servidor.

Atualização: nova identidade baseada na referência enviada, prévia corrigida, imagens sem recorte obrigatório e exclusão de contas pelo master. Veja [alterações e verificações](docs/UPDATE-2026-09-23.md). Para excluir: **Administração → Contas e formulários → Excluir**, digite o e-mail e confirme. Essa ação apaga permanentemente a conta e seus formulários/respostas; contas master são protegidas.

## Rodar localmente

Requisitos: Node.js 22.12+ (validado com 24.20) e npm. Não é necessário instalar um servidor de banco de dados.

No PowerShell, dentro desta pasta:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run dev
```

Abra **http://127.0.0.1:3000**. Use esse endereço exato: `APP_URL` também está configurado com `127.0.0.1`. Para usar `localhost`, outra porta ou domínio, altere `APP_URL` no `.env` e reinicie o servidor. Não sobrescreva um `.env` já configurado ao repetir os passos.

O arquivo SQLite será criado em `prisma/dev.db`. A migração SQL inicial está versionada em `prisma/migrations/`. O script `prepare-db.mjs` cria o arquivo vazio antes da migração para evitar uma falha de inicialização do Prisma em alguns ambientes Windows. Não altera bancos existentes.

Em macOS/Linux, os comandos são `npm`, `cp .env.example .env`, `npm run db:generate`, `npm run db:migrate` e `npm run dev`.

### Primeiro administrador master

O cadastro público **sempre** cria um `CREATOR/PENDING`. O master é provisionado exclusivamente pela linha de comando. Não há credencial padrão.

Em outro terminal PowerShell, na pasta do projeto:

```powershell
$env:ADMIN_NAME = 'Administrador Master'
$env:ADMIN_EMAIL = 'admin@seu-dominio.com'
$adminSecret = Read-Host 'Senha do master (12 a 128 caracteres)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
npm.cmd run admin:create
Remove-Item Env:ADMIN_PASSWORD
Remove-Variable adminSecret
```

Use um e-mail ainda não cadastrado. O script recusa promover ou sobrescrever contas existentes. Entre em **/master-admin** ou use o ícone de chave no rodapé do login. A discrição do link é visual: a segurança depende da função `MASTER`, do status aprovado e da sessão validada no servidor.

### Primeiro formulário

1. Na página inicial, clique em **Criar conta** e cadastre um criador.
2. Entre como master e aprove a conta em **Contas e formulários**.
3. Entre como criador e clique em **Criar formulário**.
4. Edite título, descrição, capa, cores e perguntas. Selecione um trecho e use o botão **B**, ou escreva `**negrito**`.
5. Ative **Aceitar respostas**, clique em **Salvar** e copie o link público.
6. Abra o link em janela anônima e responda. Nenhum login é solicitado.
7. No editor, abra **Respostas** e use **Todas / Pendentes / Aprovadas / Reprovadas**.

As edições têm salvamento explícito. O upload da capa é salvo imediatamente. A prévia usa os dados em edição e não envia respostas.

## Estrutura de arquivos

```text
ghostforms/
├── prisma/
│   ├── schema.prisma                 # Modelo relacional e enums
│   └── migrations/                   # SQL versionado
├── scripts/
│   ├── create-admin.ts               # Provisionamento seguro do master
│   ├── prepare-db.mjs                # Inicialização do arquivo SQLite
│   └── integration.ts                # Testes HTTP com contas temporárias
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Login/cadastro de criadores
│   │   ├── dashboard/page.tsx        # Painel individual protegido
│   │   ├── forms/[id]/page.tsx       # Editor e respostas protegidos
│   │   ├── f/[slug]/page.tsx         # Resposta pública isolada
│   │   ├── master-admin/page.tsx     # Login/painel master
│   │   ├── pending/page.tsx          # Conta sem autorização
│   │   ├── api/[...path]/route.ts    # API, autenticação e operações
│   │   ├── globals.css              # Tema, componentes e responsividade
│   │   ├── layout.tsx               # Metadados e layout raiz
│   │   └── refinement.css           # Identidade visual atualizada
│   ├── components/
│   │   ├── auth-screen.tsx
│   │   ├── dashboard.tsx
│   │   ├── editor.tsx               # Perguntas, cores, capa e prévia
│   │   ├── public-form.tsx          # Envio sem autenticação
│   │   ├── form-fields.tsx          # Renderização dos quatro tipos
│   │   ├── responses.tsx            # Filtros e moderação
│   │   ├── admin.tsx                # Contas, formulários e atividades
│   │   └── ui.tsx                   # Layout e componentes compartilhados
│   └── lib/
│       ├── auth.ts                  # Sessões e guardas de acesso
│       ├── permissions.ts           # Política de propriedade
│       ├── password.ts              # Hash scrypt com salt aleatório
│       ├── validation.ts            # Schemas Zod e validação de respostas
│       ├── http.ts                  # Origem, limites de corpo e rate limit
│       ├── db.ts                    # Prisma apenas no servidor
│       └── client.ts                # Cliente HTTP e DTOs
├── tests/security.test.ts
├── docs/ARCHITECTURE.md
├── .env.example
├── next.config.ts
└── package.json
```

## Esquema do banco de dados

Veja o esquema completo em [`prisma/schema.prisma`](prisma/schema.prisma) e o SQL em [`prisma/migrations/20260923000000_init/migration.sql`](prisma/migrations/20260923000000_init/migration.sql).

| Tabela | Finalidade e campos principais |
| --- | --- |
| `User` | Nome, e-mail único, `passwordHash`, função, status, cadastro e último login |
| `Session` | Hash do token, usuário e expiração de 7 dias |
| `Form` | Proprietário, slug aleatório, título, descrição, cores, publicação e versão |
| `Question` | Formulário, posição, título, descrição, tipo, obrigatoriedade, cor e opções |
| `Submission` | Formulário, versão respondida, status de moderação e datas |
| `Answer` | Submissão, referência opcional à pergunta, cópia do título/tipo e valor |
| `Cover` | Imagem WebP sanitizada, associada a um formulário |
| `AuditLog` | Ator, operação, referência e data de login, edição ou moderação |
| `RateLimit` | Contador persistido e vencimento por janela de tempo |

`User → Form → Question` e `Form → Submission → Answer` são relações de um para muitos. `Form → Cover` é um para um. Perguntas e respostas são registros relacionais; opções de escolha e valores multisseleção usam JSON.

Enums: função `CREATOR | MASTER`; conta `PENDING | APPROVED | REJECTED`; moderação `PENDING | APPROVED | REJECTED`; pergunta `SHORT | LONG | SINGLE | MULTIPLE`.

## Código principal e permissões

- **Editor:** [`src/components/editor.tsx`](src/components/editor.tsx).
- **Página pública:** [`src/app/f/[slug]/page.tsx`](src/app/f/[slug]/page.tsx), [`public-form.tsx`](src/components/public-form.tsx) e [`form-fields.tsx`](src/components/form-fields.tsx).
- **Moderação:** [`src/components/responses.tsx`](src/components/responses.tsx), com validação de propriedade na API.
- **Guardas:** [`src/lib/auth.ts`](src/lib/auth.ts) e [`src/lib/permissions.ts`](src/lib/permissions.ts).
- **Backend:** [`src/app/api/[...path]/route.ts`](src/app/api/[...path]/route.ts).
- **Arquitetura e contrato da API:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Operação | Visitante | Criador pendente/rejeitado | Criador aprovado | Master aprovado |
| --- | --- | --- | --- | --- |
| Responder formulário publicado de conta aprovada | Sim | Sim | Sim | Sim |
| Criar formulário | Não | Não | Sim | Sim |
| Ler/editar/apagar formulário ou moderar respostas | Não | Não | Apenas próprios | Todos |
| Listar contas, aprovar/rejeitar e consultar auditoria | Não | Não | Não | Sim |

O master vê nome, e-mail de login, função, status, datas e formulários de cada conta. Não recebe senhas atuais, hashes, tokens ou conteúdo de sessões. Pode gerar uma senha temporária após confirmar sua senha de master. Os formulários de contas rejeitadas ficam indisponíveis publicamente, e suas sessões são revogadas.

## Verificação

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
```

Com `npm run dev` rodando em outro terminal:

```powershell
npm.cmd run test:integration
```

O teste de integração cria contas exclusivamente de teste e remove somente os IDs criados por aquela execução. Testa cadastro pendente, aprovação, isolamento entre criadores, acesso master, CSRF, rascunho, envio anônimo, opções inválidas, versões concorrentes, moderação, histórico, upload seguro, revogação e logout. Execute em banco de desenvolvimento. Repetições rápidas podem atingir o rate limit compartilhado da instância local; aguarde a próxima janela de 15 minutos.

Validação desta atualização: build de produção, TypeScript, seis testes unitários e 94 verificações HTTP aprovados. Veja o relatório da atualização para a revisão visual. Dependências auditadas sem vulnerabilidades conhecidas na verificação inicial. A auditoria é pontual; mantenha as dependências atualizadas.

## Limites e implantação

- Entrega local, sem publicação externa. SQLite e capas no banco simplificam uma instância com volume persistente; o arquivo não pode ficar em disco efêmero.
- Para produção, use HTTPS e `APP_URL` com a origem real. `npm run build` e `npm run start` ativam cookies `Secure`; o servidor se vincula a `127.0.0.1` para operar atrás de proxy reverso. Para contêiner, ajuste o bind do comando de start.
- Configure o proxy para limitar corpos a 5 MB, impor timeout e sobrescrever `X-Forwarded-For`. Só então use `TRUST_PROXY=true`. Sem proxy confiável, os limites de login/cadastro são compartilhados pela instância; a API não confia em cabeçalhos de IP arbitrários.
- Limites: 50 perguntas por formulário, 30 opções por pergunta, texto curto de até 500 caracteres, texto longo de até 10.000, capa de até 4 MB/20 megapixels e paginação de 20 registros. O corpo JSON inteiro é limitado a 256 KB.
- Autenticação inclui sessão persistente, aprovação e revogação. Recuperação assistida pelo master está disponível; recuperação por e-mail, confirmação de e-mail e MFA não fazem parte desta base.
- A CSP permite scripts inline exigidos pela hidratação do Next; uma política com nonce por requisição é uma evolução recomendada. Nenhum conteúdo do usuário é inserido como HTML.
- Para escalar horizontalmente: PostgreSQL, armazenamento de objetos para capas, Redis para limites distribuídos, migrações novas específicas do PostgreSQL e backups com teste de restauração. Não aplique o SQL SQLite diretamente no PostgreSQL.
- Exclusão de formulário remove perguntas, capa e respostas em cascata. A UI pede confirmação. Logs de alterações permanecem com a referência ao formulário excluído.

Referências técnicas: [autenticação e autorização no Next.js](https://nextjs.org/docs/app/guides/authentication), [segurança de dados no Next.js](https://nextjs.org/docs/app/guides/data-security) e [SQLite no Prisma 6](https://docs.prisma.io/docs/orm/v6/overview/databases/sqlite). O projeto mantém Prisma 6 explicitamente, com lockfile e override de `deepmerge-ts` para a versão corrigida 8.0.0, validado nas migrações e testes. Sharp está fixado em 0.35.4, inclusive nas dependências transitivas.


## Novas funções do master — passo a passo

1. Abra http://127.0.0.1:3000/master-admin e entre com sua conta master.
2. Em **Contas e formulários**, localize a conta desejada.
3. Clique em **Criar formulário** para abrir um rascunho pertencente àquela conta. Edite e salve normalmente. Contas pendentes ou rejeitadas continuam sem acesso ao painel e seus formulários ficam indisponíveis ao público.
4. Se o usuário esqueceu a senha, clique em **Recuperar acesso**. Digite **sua senha de master** e clique em **Gerar senha temporária**.
5. Copie a senha exibida e entregue ao dono da conta. Ela expira em 24 horas, substitui a senha antiga e encerra as sessões anteriores. Ao entrar, o usuário precisa escolher uma nova senha de pelo menos 12 caracteres. A aprovação da conta não muda.
6. Depois de fechar a janela, a senha temporária não pode ser consultada novamente. Se necessário, gere outra. Senhas pessoais nunca são armazenadas em texto legível.

O nick público corresponde ao nome cadastrado do proprietário. Quando o master cria um formulário para outra conta, aparece o nick daquela conta. O convite discreto abaixo do formulário e da confirmação abre diretamente o cadastro, ainda sujeito à aprovação manual.

Em outra instalação, pare o servidor e execute `npm.cmd run db:migrate` e `npm.cmd run db:generate` antes de iniciar `npm.cmd run dev`. Nesta instalação a migração já foi aplicada.

## Publicação com link público

O projeto possui configuração gratuita para Render (servidor) + Neon (PostgreSQL).
A versão local continua usando SQLite. Consulte [o guia de publicação](docs/PUBLICACAO.md).
A presença de `render.yaml` no GitHub não significa que o site já está publicado:
é necessário autenticar os serviços, configurar o banco e validar a URL pública.
