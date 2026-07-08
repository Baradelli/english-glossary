# Landing page (GitHub Pages) — design

**Data:** 2026-07-08 · **Aprovado por:** Vitor (inline, nesta sessão)

## Objetivo

Página pública que apresenta o English Glossary e oferece o download do instalador Windows. Quem instala uma vez não volta mais: o app se atualiza sozinho via GitHub Releases.

## Decisões

- **Hospedagem:** GitHub Pages servindo `main:/docs` (sem branch órfã, sem Actions). URL: `https://baradelli.github.io/english-glossary/`.
- **Página:** `docs/index.html` único e autocontido (CSS/JS inline, sem frameworks, pt-BR, responsivo, claro/escuro via `prefers-color-scheme`). Imagens em `docs/assets/`.
- **Botão de download:** JS consulta `https://api.github.com/repos/Baradelli/english-glossary/releases/latest` (repo público, sem token), acha o asset `.exe` e preenche `href` + versão no botão. Fallback estático: link para `/releases` se a API falhar. Nomes de artefato versionados continuam como estão (o auto-update depende deles).
- **Conteúdo:** hero + botão · "como funciona" (fontes → captura → revisão SM-2 → provas) · screenshots reais · recursos (offline, dados locais + backup, IA opcional, auto-update) · FAQ (SmartScreen passo a passo, onde ficam os dados, atualizações, requisitos) · footer com link do GitHub.
- **Screenshots:** capturados de um banco de demonstração descartável (nunca o dev.db), com `onboardingSeenAt` semeado para o tour não poluir as capturas; navegador headless (Edge) em 1280px; tema escuro capturado alternando a Setting `theme` no banco demo.

## Pré-requisitos / sequência

1. Varredura do histórico git por segredos (`sk-ant-`) → tornar o repo **público** (gh CLI). Público é requisito do Pages gratuito E do electron-updater.
2. Página + assets commitados na branch `feature/desktop-app` (entram no PR #1).
3. Publicar a **release v0.1.0** (`desktop:publish` com o token do gh CLI; draft → published) para o botão ter alvo real.
4. Após o merge do PR #1: ativar o Pages (`main:/docs`) e validar a URL no ar.

## Fora de escopo

Domínio próprio, analytics, i18n além de pt-BR, builds mac/linux.

## Riscos aceitos

- `docs/` também serve `design.md`/specs pelo Pages — irrelevante num repo público (já visíveis no repo).
- Instalador não assinado → SmartScreen na primeira instalação; a página explica o desvio.
