
import sys, re, json
sys.path.append("/my/proj/sparqlhttp/build/lib.linux-x86_64-2.6")
from sparqlhttp.graph2 import SyncGraph
from memoize import lru_cache
from rdflib import RDFS, Literal, Namespace

SKIP = Namespace('http://skipforward.net/skipforward/resource/seeder/skipinions/')
DBT = Namespace('http://dbtropes.org/ont/')
MAIN = Namespace('http://dbtropes.org/resource/Main/')
FILM = Namespace('http://dbtropes.org/resource/Film/')

graph = SyncGraph("sesame", "http://bang:9080/sparql/",
                  initNs=dict(rdfs=RDFS.RDFSNS, skip=SKIP, dbt=DBT)
                  )

def findMovie(name):
    rows = graph.queryd("SELECT DISTINCT ?uri WHERE { ?uri rdfs:label ?name }",
                        initBindings={"name" : Literal(name, lang="en")})
    try:
        return rows[0]['uri']
    except IndexError:
        raise ValueError("movie %r not found" % name)

@lru_cache(10000)
def movieName(uri):
    return graph.queryd("SELECT ?label WHERE { ?uri rdfs:label ?label }",
                        initBindings={"uri" : uri})[0]['label']

def findMoviesByRegex(s):
    return [r['movie'] for r in graph.queryd("""
      SELECT DISTINCT ?movie WHERE {
        ?movie a dbt:TVTItem;
          rdfs:label ?label .
        FILTER (regex(?label, "%s"))
      }
    """ % re.escape(s))]

def allItems(limit=10):
    return [r['i'] for r in graph.queryd(
        "SELECT DISTINCT ?i WHERE { ?i a dbt:TVTItem } LIMIT %d" % limit)]

stopFeatures = set([SKIP['ItemName']])
@lru_cache(10000)
def movieFeatures(movie):
    return set(r['trope'] for r in graph.queryd("""
      SELECT DISTINCT ?trope WHERE {
        ?movie skip:hasFeature ?f .
        ?f a ?trope .
      }
    """, initBindings={"movie" : movie})
               if r['trope'] not in stopFeatures)

def countFeatures(m1, m2):
    f1 = movieFeatures(m1)
    f2 = movieFeatures(m2)
    return len(f1), len(f2), len(f1.intersection(f2))
    
def top500():
    uris = []
    for title in open("top500"):
        title = title.strip()
        try:
            uris.append(findMovie(title))
        except (KeyError, ValueError):
            print "couldn't find uri for %s" % title
    return uris



#print findMoviesByRegex("shrek")
#print movieFeatures(findMovie("Lord"))
#print countFeatures(MAIN['Shrek'], MAIN['TheMatrix'])
#print countFeatures(FILM['DieHard'], MAIN['TheMatrix'])

