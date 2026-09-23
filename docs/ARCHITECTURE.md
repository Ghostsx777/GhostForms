# Arquitetura do GhostForms

## Camadas e fluxo

```mermaid
flowchart LR
    A[Visitante] --> P[/f/slug: formulário público]
    C[Criador aprovado] --> E[Editor e respostas]
    M[Master] --> AD[Contas e auditoria]
    P --> API[Route Handlers: validação e regras]
    E --> API
    AD --> API
    API --> AUTH[Sessão e autorização]
    AUTH --> DB[(Prisma / SQLite)]
    API --> DB
```

As páginas privadas fazem a verificação antes de renderizar. Cada endpoint faz sua própria verificação também: esconder elementos no React não concede segurança. `getUser()` consulta a sessão pelo hash do token e lê o estado atual do usuário. `requireUser()` exige aprovação; `requireUser(true)` exige master. `requireForm()` exige propriedade ou master e retorna 404 para o criador que tenta adivinhar um formulário de outra conta.

Mutação de perguntas, exclusão, capa e moderação revalidam o acesso dentro da transação. Edição e criação de submissões são atômicas. A API não aceita `ownerId`, `role`, `status` de conta ou status de moderação no cadastro/envio público.

## Sessões e credenciais

- Senhas de 12 a 128 caracteres, salt criptograficamente aleatório por usuário, scrypt e comparação em tempo constante.
- Tokens aleatórios de 256 bits. O navegador recebe cookie `HttpOnly`, `SameSite=Lax`, prazo de sete dias e `Secure` em produção.
- Banco armazena SHA-256 do token, não o token em texto puro.
- Login substitui a sessão anterior do mesmo navegador. Logout revoga a sessão no banco. Rejeição/desativação revoga todas as sessões do criador.
- Conta pendente pode autenticar para consultar seu estado, mas não acessar recursos privados de criação.
- O master inicial exige provisionamento por CLI; a CLI nunca transforma uma conta pública existente em master.

## Dados públicos

O DTO público inclui somente título, descrição, cores, versão, slug, existência da capa e perguntas. E-mail, proprietário, sessões, respostas anteriores e metadados administrativos não são enviados ao navegador do respondente. A página pública possui layout próprio sem navegação para o painel.

Um link aleatório é compartilhável, não é autenticação do respondente. Quem tem o link pode responder. A aplicação não promete uma única resposta por pessoa e não coleta IP ou identidade como parte da resposta. Limites por janela reduzem abuso, mas CAPTCHA ou um serviço antiabuso podem ser adicionados conforme o uso real.

## Histórico e concorrência

`Form.version` é incrementado ao salvar. O editor envia a versão lida e a API usa atualização condicional; se outro editor ou master salvou primeiro, retorna 409. A submissão também inclui a versão; formulários alterados entre abertura e envio exigem recarregar.

Ao salvar, perguntas são substituídas em transação. `Answer.questionId` usa `ON DELETE SET NULL`, enquanto `questionTitle`, `questionType`, `position` e `value` preservam o que foi respondido. As opções são armazenadas como os textos escolhidos. Assim, editar, renomear ou remover perguntas não reinterpreta respostas antigas.

Moderação segue a última ação confirmada. Cada alteração registra ator, referência, ação e data em `AuditLog`; o status atual e `moderatedAt` ficam em `Submission`. O master também pode moderar. A tabela de auditoria registra logins bem-sucedidos; tentativas malsucedidas são limitadas, mas não há histórico detalhado de falhas nesta base.

## API

Todas as respostas JSON privadas usam `Cache-Control: no-store`. Mutação requer `Origin` igual à origem configurada em `APP_URL`, inclusive envio público. Clientes de API de confiança devem enviar explicitamente esse cabeçalho. Sessões continuam obrigatórias nas rotas privadas; o cabeçalho não substitui autenticação.

| Método / caminho | Acesso | Finalidade |
| --- | --- | --- |
| `POST /api/auth/register` | Público | Cadastro pendente; resposta genérica para e-mail existente |
| `POST /api/auth/login` | Público | Validar senha e iniciar sessão |
| `POST /api/auth/logout` | Sessão opcional | Revogar sessão atual |
| `GET /api/auth/session` | Público | Usuário seguro da sessão ou null |
| `GET /api/forms?page=0` | Aprovado | Listar apenas próprios formulários |
| `POST /api/forms` | Aprovado | Criar rascunho com primeira pergunta |
| `GET/PATCH/DELETE /api/forms/:id` | Proprietário/master | Ler, salvar ou excluir |
| `GET/POST /api/forms/:id/cover` | Proprietário/master | Ler ou enviar bytes da capa |
| `GET /api/forms/:id/responses?status=ALL&page=0` | Proprietário/master | Listar respostas e contagens por status |
| `PATCH /api/responses/:id` | Proprietário/master | Alterar status de moderação |
| `GET /api/users?page=0` | Master | Contas, dados de login e contagem de formulários |
| `PATCH /api/users/:id` | Master | Aprovar, rejeitar ou retornar criador a pendente |
| `DELETE /api/users/:id` | Master | Excluir criador e seus dados; corpo `{ "email": "email-da-conta" }` obrigatório; masters protegidos |
| `GET /api/users/:id/forms?page=0` | Master | Formulários da conta selecionada |
| `GET /api/audit?page=0` | Master | Logins e ações administrativas |
| `GET /api/public/:slug` | Público, se publicado e proprietário ativo | Conteúdo necessário para responder |
| `GET /api/public/:slug/cover` | Público, se publicado e proprietário ativo | Capa WebP |
| `POST /api/public/:slug` | Público, se publicado e proprietário ativo | Validar e persistir submissão pendente |

Filtros de moderação: `ALL`, `PENDING`, `APPROVED`, `REJECTED`. Listagens retornam `{ items, hasMore }`; páginas começam em zero e contêm até 20 itens.

Exemplo de envio público:

```json
{
  "version": 3,
  "answers": {
    "uuid-da-pergunta-texto": "Minha resposta",
    "uuid-da-pergunta-multipla": ["Opção A", "Opção B"]
  }
}
```

Exemplo de moderação:

```json
{ "status": "APPROVED" }
```

Erros controlados usam `{ "error": "mensagem" }`: 400 para validação, 401 sem sessão, 403 sem permissão/origem incorreta, 404 indisponível, 409 conflito de versão, 413 tamanho excedido e 429 limite de tentativas. Erros inesperados retornam mensagem genérica sem stack trace.

## Upload e formatação

A imagem é transmitida como bytes para evitar arquivos com nomes/caminhos controlados pelo usuário. A API limita o corpo, decodifica com Sharp, verifica formato real, limita pixels, remove metadados pela recodificação e gera WebP dentro de 1600×1600, preservando proporção sem recorte. Aceita quadradas, retratos e banners. Não serve SVG nem executa arquivos enviados. O acesso público à imagem acompanha o estado de publicação e da conta.

Somente `**negrito**` é interpretado. `BoldText` separa trechos e renderiza componentes React: não usa `dangerouslySetInnerHTML`. Valores de cor aceitam somente seis dígitos hexadecimais. O contraste dos textos muda conforme a luminância do fundo escolhido.

## Evolução da base

O único Route Handler concentra o contrato HTTP para facilitar a leitura desta base. Em uma equipe maior, separar operações em serviços (`forms`, `accounts`, `moderation`) e repositórios preservando as mesmas guardas e transações é uma evolução natural. SQLite é adequado ao desenvolvimento e a uma instância persistente de pequeno porte; múltiplas instâncias exigem revisar banco, armazenamento e controle de tráfego em conjunto.
