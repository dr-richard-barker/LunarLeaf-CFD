import os
BS = chr(92)
f = "results/manuscript/manuscript.tex"
s = open(f, encoding="utf-8").read()
print("begin/end:", s.count(BS + "begin{"), s.count(BS + "end{"))
print("table:", s.count(BS + "begin{table}"), s.count(BS + "end{table}"))
print("figure:", s.count(BS + "begin{figure}"), s.count(BS + "end{figure}"))
print("tabular:", s.count(BS + "begin{tabular}"), s.count(BS + "end{tabular}"))
print("braces:", s.count("{"), s.count("}"))
d = sum(1 for i, ch in enumerate(s) if ch == "$" and (i == 0 or s[i - 1] != BS))
print("inline $:", d, "EVEN" if d % 2 == 0 else "ODD!!")
for line in s.splitlines():
    if BS + "includegraphics" in line:
        fn = line.split("{")[-1].split("}")[0]
        print("  fig", fn, "OK" if os.path.exists("results/figures/" + fn) else "MISSING!!")
print("non-ASCII:", sorted(set(ch for ch in s if ord(ch) > 127)))
for tok in [BS + "SI{", BS + "si{"]:
    if s.count(tok):
        print("LEFTOVER", tok, s.count(tok))
