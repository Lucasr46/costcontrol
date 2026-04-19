# Cost Control

## Visao Geral

O Cost Control e um sistema desktop de gestao de custo pessoal com foco em:

- planejamento mensal
- controle de receitas, despesas e investimentos
- comparacao entre gasto real e limite planejado
- acompanhamento de metas financeiras
- uso intensivo de cartao de credito com ciclo de fatura personalizado

Direcao visual:

- estilo minimalista
- branco como cor principal
- azul como cor secundaria
- cinza claro para apoio visual
- layout corporativo e limpo, com destaque moderado em indicadores

## Mapa de Navegacao

### Estrutura Principal

1. Dashboard
2. Planejamento
3. Lancamentos
4. Cartao
5. Investimentos
6. Metas
7. Categorias
8. Relatorios
9. Historico

### Hierarquia de Telas

#### 1. Dashboard

Objetivo: concentrar os principais indicadores do mes e do saldo geral.

Blocos:

- resumo financeiro
- comparativo de orcamento
- grafico de despesas
- status da fatura
- progresso de metas
- alertas

#### 2. Planejamento

Objetivo: definir a renda do mes e como ela sera distribuida.

Subareas:

- planejamento do mes
- configuracao por percentual
- configuracao por valor
- resumo do planejamento

Fluxo:

1. informar renda mensal
2. definir regra para custo fixo
3. definir regra para custo variavel
4. definir regra para investimento
5. validar quanto ainda sobra no mes

#### 3. Lancamentos

Objetivo: registrar todas as movimentacoes financeiras.

Subareas:

- lista de lancamentos
- novo lancamento
- editar lancamento
- detalhes do lancamento

Tipos:

- receita
- despesa
- investimento

Recursos:

- manual
- recorrente
- parcelado
- filtros por periodo
- filtros por categoria e subcategoria

#### 4. Cartao

Objetivo: controlar compras, parcelas e faturas de cartao de credito.

Subareas:

- configuracao do cartao
- fatura atual
- faturas anteriores
- parcelas futuras

Regras:

- ciclo de fatura entre dia 25 e dia 25
- pagamento no dia 01
- compra entra na fatura correspondente
- parcelamento se distribui automaticamente entre meses futuros

#### 5. Investimentos

Objetivo: acompanhar aportes sem trata-los como despesa.

Subareas:

- resumo de investimentos
- historico de aportes
- metas anuais

Categorias iniciais:

- renda fixa
- acoes

#### 6. Metas

Objetivo: acompanhar objetivos financeiros de economia e investimento.

Subareas:

- meta de economia geral
- meta anual de investimento
- progresso acumulado

Indicadores:

- valor alvo
- valor acumulado
- percentual atingido

#### 7. Categorias

Objetivo: manter a estrutura modular de classificacao.

Subareas:

- categorias
- subcategorias

Regras:

- categoria deve ser fixa ou variavel
- categoria em uso nao pode ser excluida
- ao tentar excluir, mostrar alerta orientando a alterar a despesa vinculada

#### 8. Relatorios

Objetivo: permitir analise financeira por recortes e comparativos.

Prioridade inicial:

- por categoria

Filtros:

- semanal
- mensal
- anual
- fixo x variavel
- comparacao entre meses

#### 9. Historico

Objetivo: localizar rapidamente qualquer movimentacao.

Recursos:

- busca textual
- filtros combinados
- linha do tempo de movimentacoes

## Fluxos Principais

### Fluxo 1: Planejar o mes

1. abrir Planejamento
2. selecionar mes de referencia
3. informar renda mensal
4. definir divisao entre fixo, variavel e investimento
5. salvar
6. visualizar limites refletidos no Dashboard

### Fluxo 2: Registrar despesa no cartao

1. abrir Lancamentos
2. criar despesa
3. definir cartao de credito como forma de pagamento
4. informar quantidade de parcelas
5. sistema distribui parcelas nas faturas futuras
6. Dashboard e tela Cartao refletem impacto no orcamento

### Fluxo 3: Acompanhar meta

1. abrir Metas
2. definir meta de economia geral ou investimento anual
3. visualizar progresso no Dashboard
4. comparar planejado x realizado

## Dashboard

### Objetivo da Tela

Ser a principal tela de decisao do usuario, com visao rapida e clara do estado financeiro atual.

### Layout Sugerido

#### Barra superior

- logo Cost Control
- seletor de mes
- acao rapida para novo lancamento

#### Linha 1: Indicadores principais

Quatro cards horizontais:

1. Saldo geral
2. Saldo do mes
3. Receitas do mes
4. Despesas do mes

Observacao:

- investimento do mes aparece em um card de destaque proprio na linha 2

#### Linha 2: Orcamento e controle

Tres cards principais:

1. Custo fixo
   - limite planejado
   - total utilizado
   - percentual consumido
   - restante disponivel

2. Custo variavel
   - limite planejado
   - total utilizado
   - percentual consumido
   - restante disponivel

3. Investimentos
   - valor planejado
   - valor realizado
   - percentual da meta

#### Linha 3: Analise visual

Dois blocos:

1. Grafico de despesas por categoria
2. Grafico comparativo entre meses

#### Linha 4: Cartao e metas

Dois cards:

1. Fatura atual
   - periodo da fatura
   - valor atual acumulado
   - valor previsto final
   - quanto ainda pode comprometer
   - vencimento no dia 01

2. Meta anual de investimento
   - alvo anual
   - total acumulado
   - percentual atingido

#### Linha 5: Alertas e insights

Lista compacta com:

- orcamento mensal ultrapassado
- categoria com maior gasto
- comparativo contra mes anterior
- aviso de concentracao de gastos fixos ou variaveis

## Wireframe Textual

```text
+----------------------------------------------------------------------------------+
| Cost Control                                             [Mes Atual] [Adicionar] |
+----------------------------------------------------------------------------------+
| [Saldo Geral]      [Saldo do Mes]      [Receitas]         [Despesas]             |
| R$ 12.400,00       R$ 2.150,00         R$ 5.000,00        R$ 2.850,00            |
+----------------------------------------------------------------------------------+
| [Custo Fixo]                 [Custo Variavel]             [Investimentos]        |
| Limite: R$ 2.500,00          Limite: R$ 1.500,00          Meta: R$ 1.000,00      |
| Usado: R$ 1.900,00           Usado: R$ 1.120,00           Aplicado: R$ 800,00    |
| Restante: R$ 600,00          Restante: R$ 380,00          Progresso: 80%         |
+----------------------------------------------------------------------------------+
| [Grafico: Despesas por Categoria]   | [Grafico: Comparacao Mensal]               |
| Alimentacao | Carro | Lazer | ...   | Jan | Fev | Mar | Abr                      |
+----------------------------------------------------------------------------------+
| [Fatura Atual]                        | [Meta de Investimento]                    |
| Ciclo: 25/03 - 25/04                  | Alvo anual: R$ 100.000,00                 |
| Vencimento: 01/05                     | Acumulado: R$ 24.000,00                   |
| Parcial: R$ 1.340,00                  | Progresso: 24%                            |
| Disponivel: R$ 160,00                 |                                            |
+----------------------------------------------------------------------------------+
| Alertas e Insights                                                           |
| - Gasto variavel consumiu 74% do limite do mes                               |
| - Alimentacao foi a categoria com maior impacto                              |
| - Voce gastou 12% a menos que no mes passado                                 |
+----------------------------------------------------------------------------------+
```

## Componentes Essenciais do Dashboard

- card financeiro com valor principal e subtitulo
- barra de progresso para limites
- grafico de pizza ou rosca para categoria
- grafico de barras para comparacao mensal
- lista de alertas priorizada
- seletor de mes global

## Modelo de Navegacao Entre Telas

- Dashboard -> atalho para novo lancamento
- Dashboard -> atalho para detalhes da fatura
- Dashboard -> atalho para metas
- Planejamento -> alimenta Dashboard
- Lancamentos -> alimenta Dashboard, Cartao, Relatorios e Historico
- Cartao -> consolida despesas pagas no credito
- Categorias -> alimenta Lancamentos e Relatorios
- Investimentos -> alimenta Metas e Dashboard

## Decisoes de UX

- foco em leitura rapida no desktop
- cards com espacamento amplo
- pouco ruido visual
- azul usado para destaque de informacao positiva e navegacao ativa
- vermelho reservado para excesso de orcamento ou alerta critico
- cinza claro para divisorias e fundos de bloco

## Proximo Passo Recomendado

Partir para:

1. definicao do esquema de banco de dados
2. escolha da stack de frontend e backend
3. implementacao inicial das telas Dashboard e Planejamento