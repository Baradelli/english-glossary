# PRODUCT.md — English Glossary

## O que é

App desktop Windows (Electron + Next.js local) para estudo pessoal de vocabulário de inglês: o usuário registra as **fontes** que consome (vídeos, livros, artigos), **captura** palavras com a frase original em que apareceram, **revisa** com repetição espaçada (SM-2) e testa-se em **provas**. Single-user, offline-first, dados 100% locais (SQLite em %APPDATA%), backup JSON, IA opcional via chave própria da Anthropic. Também é peça de portfólio: a barra é código limpo e decisões bem justificadas.

## Quem usa

Estudantes autodidatas de inglês (o autor é o usuário zero) que consomem conteúdo real em inglês e querem transformar vocabulário encontrado "na natureza" em retenção de longo prazo — sem planilha, sem serviço na nuvem, sem assinatura.

## Voz da marca

Estudioso, direto, sem firula. Um caderno de estudo bem organizado, não um SaaS. Confiável e honesto (avisos claros sobre SmartScreen, dados locais, IA opcional).

## Registro

- **App (telas internas):** product — design serve a tarefa. Sistema atual: Tailwind, neutros `slate`, primário `blue-600`, tema claro/escuro/sistema, pt-BR.
- **Landing page (docs/index.html):** brand — apresenta e distribui o app. Deve harmonizar com os screenshots reais (slate/azul) sem parecer template.

## Superfícies

- App desktop (instalador NSIS + auto-update via GitHub Releases).
- Landing page no GitHub Pages (`main:/docs`) com download da última release.

## Restrições

- pt-BR em toda UI. Sem serviços externos na operação normal (offline-first). A chave de API nunca sai da máquina do usuário. Página da web: estática, sem build, sem frameworks.
