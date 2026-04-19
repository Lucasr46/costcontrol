# Publicação do Cost Control

## 1. GitHub
1. Crie um repositório vazio chamado `cost-control`.
2. No diretório do projeto, execute:
   - `git init`
   - `git add .`
   - `git commit -m "Initial Cost Control app"`
   - `git branch -M main`
   - `git remote add origin <URL_DO_REPOSITORIO>`
   - `git push -u origin main`

## 2. Supabase
1. Crie um projeto no Supabase.
2. Em `SQL Editor`, execute o conteúdo de [supabase-schema.sql](./supabase-schema.sql).
3. Em `Authentication > URL Configuration`, cadastre a URL local e a URL pública do deploy.
4. Copie `Project URL` e `anon public key`.
5. Preencha [cost-control.config.js](./cost-control.config.js).

## 3. Vercel
1. Importe o repositório do GitHub na Vercel.
2. Não é necessário comando de build.
3. O arquivo [vercel.json](./vercel.json) já aponta `/` para [cost-control-v2.html](./cost-control-v2.html).
4. Após o deploy, atualize `authRedirectTo` em [cost-control.config.js](./cost-control.config.js) com a URL final, se necessário.

## 4. Primeiro acesso
1. Abra a aplicação.
2. Informe o e-mail.
3. Clique no link mágico recebido.
4. O Cost Control criará seu perfil, sincronizará as categorias padrão e passará a salvar tudo remotamente.
