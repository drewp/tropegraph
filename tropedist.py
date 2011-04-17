#!bin/python
from __future__ import division
import logging, gexf, jsonlib, decimal
from db import MAIN, movieFeatures, movieName, top500
logging.basicConfig(level=logging.WARN)

movs = sorted(top500())
#movs = [MAIN['Titanic'], MAIN['ToyStory'], MAIN['TheTrumanShow'], MAIN['Transformers']]

print "found", len(movs)

shared = {} # (m1,m2) : counts
for i, m1 in enumerate(movs):
    print "left movie %s of %s" % (i, len(movs))
    f1 = movieFeatures(m1)
    if not f1:
        continue
    for m2 in movs[i+1:]:
        print "  right movie %s" % m2
        f2 = movieFeatures(m2)
        if not f2:
            continue
        intersect = len(f1.intersection(f2))
        union = len(f1.union(f2))
        frac = intersect / union if union else 0
        shared[(m1,m2)] = (decimal.Decimal("%.4f" % frac),
                           intersect)

edgeId = 0
doc = gexf.Gexf("drewp", "tropes")
out = doc.addGraph("undirected", "static", "common tropes")
for (m1, m2), count in shared.items():
    n1 = out.addNode(m1, movieName(m1))
    n2 = out.addNode(m2, movieName(m2))
    if count:
        out.addEdge(edgeId, m1, m2, weight=count)
    edgeId += 1
doc.write(open("out.gexf", "w"))
    
d3graph = {"nodes" : [], "links" : []}
for m in movs:
    d3graph['nodes'].append({'name' : movieName(m)})
for (m1, m2), counts in shared.items():
    if count:
        d3graph['links'].append({
            'source' : movs.index(m1),
            'target' : movs.index(m2),
            'fracShare' : counts[0],
            'absShare' : counts[1]
            })
open("out.json", "w").write(jsonlib.dumps(d3graph))
                                
