# Cost Control

Aplicação web de gestão de custo pessoal com foco em planejamento mensal, categorias, lançamentos e relatórios.

## Estado atual

- interface principal em [cost-control-v2.html](./cost-control-v2.html)
- autenticação por link mágico via Supabase
- sincronização remota de planejamento, categorias, lançamentos e preferências
- modo demonstração local para testar a interface sem backend
- publicação preparada para Vercel com [vercel.json](./vercel.json)

## Arquivos principais

- [cost-control-v2.html](./cost-control-v2.html): interface principal
- [cost-control-v2.css](./cost-control-v2.css): estilos da aplicação
- [cost-control-v2.js](./cost-control-v2.js): lógica de autenticação, sincronização e UI
- [cost-control.config.js](./cost-control.config.js): configuração do Supabase
- [supabase-schema.sql](./supabase-schema.sql): schema e políticas RLS
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md): passo a passo de GitHub, Supabase e Vercel

## Como rodar localmente

1. Abra [cost-control-v2.html](./cost-control-v2.html) no navegador.
2. Se quiser apenas testar a interface, use o botão `Usar modo demonstração local`.
3. Se quiser login e sincronização:
   - crie um projeto no Supabase
   - rode o SQL de [supabase-schema.sql](./supabase-schema.sql)
   - preencha [cost-control.config.js](./cost-control.config.js)

## Publicação

Use o guia em [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## Observações

- o cache local continua sendo usado apenas como apoio de sessão e migração
- a fonte principal de verdade, quando autenticado, passa a ser o Supabase
