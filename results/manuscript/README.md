# LaTeX manuscript draft

`manuscript.tex` — the LunarLeaf‑CFD draft in an *npj Microgravity* / Nature‑portfolio style.

## Compile
Needs a standard TeX distribution (TeX Live, MiKTeX). No external `.bib` — references are inline.

```bash
pdflatex manuscript.tex
pdflatex manuscript.tex     # second pass resolves \ref and \cite numbers
```

Figures are pulled from `../figures/` (relative path via `\graphicspath`); keep the folder layout intact.
Output: `manuscript.pdf`.

## Notes
- Self‑contained: standard `article` class + widely available packages (graphicx, authblk, natbib,
  booktabs, hyperref, amsmath). No `siunitx` dependency — units use small `\ensuremath` helper macros.
- References are a **preliminary list** (`thebibliography`, numeric superscript via `natbib[super]`) — to be
  finalised with DOIs/PMCIDs. Author list and affiliations are placeholders.
- Nine main figures (F1, F3–F10) and five tables are typeset; the diel‑flux panel (F2) and the raw
  time‑series tables (T4, T7, T9) are supplementary — see `../figures/` and `../tables/`.
- To submit to a Springer Nature journal, drop the body into the official `sn-jnl.cls` template.
- The full readable version with all figures embedded is `../MANUSCRIPT.md`.
- Structure validated with `../../validation/check_tex.py` (environments, braces, math, figure paths).
