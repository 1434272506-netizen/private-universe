import csv,json,pathlib,hashlib,shutil,urllib.request
import pyarrow.parquet as pq
import pyarrow.compute as pc
out=pathlib.Path('src/natural/connectome');src=pathlib.Path('work/connectome-source')
rows=list(csv.DictReader(open(src/'annotations.tsv'),delimiter='\t'));complete=set(r[0] for r in list(csv.reader(open(src/'Completeness_783.csv')))[1:]);nodes=[];groups={};used=set()
nts={'acetylcholine':'ACH','gaba':'GABA','glutamate':'GLUT'}
def add(name,count,predicate=None,side=None):
 start=len(nodes)
 if predicate:
  candidates=sorted([r for r in rows if r['root_id'] in complete and r['root_id'] not in used and r['top_nt'] in nts and predicate(r) and (not side or r['side']==side)],key=lambda r:int(r['root_id']))
  for r in candidates[:count]:
   used.add(r['root_id']);nodes.append({'id':r['root_id'],'type':r['cell_type'],'hemibrainType':r['hemibrain_type'],'nt':nts[r['top_nt']],'side':r['side'],'group':name})
 else:
  for i in range(count):nodes.append({'id':'virtual-'+name+str(i),'type':name,'nt':'ACH','side':'model','group':name})
 groups[name]={'start':start,'count':len(nodes)-start}
for name,num in [('LC10',40),('LC4',16),('ORN',16),('uPN',12),('MBON',8)]:
 for suffix,side in [('L','left'),('R','right')]:
  def pred(r,n=name):
   if n=='uPN':return r['cell_class']=='ALPN' and r['cell_type'].endswith(('adPN','lPN','vPN'))
   if n=='LC4':return r['cell_type']=='LC4'
   return r['cell_type'].startswith(n)
  add(name+'_'+suffix,num,pred,side)
for name,num,typ in [('E-PG',32,'EPG'),('Delta7',16,'Delta7')]:add(name,num,lambda r,t=typ:r['cell_type']==t)
for name,num in [('PFL3',12),('DNa01',1),('DNa02',1)]:
 for suffix,side in [('L','left'),('R','right')]:add(name+'_'+suffix,num,lambda r,t=name:r['cell_type']==t,side)
add('DNp01',2,lambda r:r['cell_type']=='DNp01')
for name in ['PDF_Clock','Octopamine','Bioluminescence']:add(name,8)
assert all(g['count'] for g in groups.values()),groups
ids={int(n['id']):i for i,n in enumerate(nodes) if n['id'].isdigit()}
t=pq.read_table(src/'connectivity.parquet',columns=['Presynaptic_ID','Postsynaptic_ID','Connectivity']);t=t.filter(pc.and_(pc.is_in(t['Presynaptic_ID'],value_set=__import__('pyarrow').array(list(ids))),pc.is_in(t['Postsynaptic_ID'],value_set=__import__('pyarrow').array(list(ids)))))
edges=[{} for _ in nodes]
for a,b,c in zip(*t.to_pydict().values()):edges[ids[a]][ids[b]]={'raw':c,'real':True}
# Retain strongest 4 outgoing edges per real neuron; relative count ratios remain intact.
for i,row in enumerate(edges):
 row=dict(sorted(row.items(),key=lambda v:-v[1]['raw'])[:4]);total=sum(v['raw'] for v in row.values()) or 1
 for v in row.values():v['weight']=round(3*v['raw']/total,5)
 edges[i]=row
# Explicitly modeled routing supplements, NOT claimed as measured FlyWire edges.
def route(a,b,w=1.4):
 aa=groups[a];bb=groups[b]
 for pre in range(aa['start'],aa['start']+aa['count']):
  for k in range(min(2,bb['count'])):
   post=bb['start']+(pre+k)%bb['count']
   if post not in edges[pre]:edges[pre][post]={'weight':w,'raw':0,'real':False}
for side in ['L','R']:
 for a,b in [('LC10','PFL3'),('ORN','uPN'),('uPN','MBON'),('uPN','PFL3'),('PFL3','DNa02'),('PFL3','DNa01'),('LC4','DNa02')]:route(a+'_'+side,b+'_'+side,2)
 route('LC4_'+side,'DNp01',2)
 route('LC10_'+side,'DNa02_'+side,.5)
 route('uPN_'+side,'DNa02_'+side,.4)
 route('E-PG','PFL3_'+side,.5)
route('E-PG','E-PG',.6);route('E-PG','Delta7',.8);route('Delta7','E-PG',.8)
route('PDF_Clock','Octopamine',4);route('Octopamine','Bioluminescence',4)
offsets=[0];targets=[];weights=[];raw=[];kinds=[];exc=inh=0
for i,row in enumerate(edges):
 sign=1 if nodes[i]['nt']=='ACH' else -1
 for target,v in sorted(row.items()):
  targets.append(target);weights.append(sign*v['weight']);raw.append(v['raw']);kinds.append(int(v['real']));exc+=sign>0;inh+=sign<0
 offsets.append(len(targets))
meta={'neurons':len(nodes),'synapses':len(targets),'excitatoryEdges':exc,'inhibitoryEdges':inh,'measuredEdges':sum(kinds),'modeledEdges':len(kinds)-sum(kinds),'realAnnotatedNeurons':len(ids),'model':'FlyWire / Shiu 2024 LIF reduced hybrid subnetwork','provenance':'Measured FlyWire v783 induced edges + explicitly synthetic control/clock routing. Not a validated fruit-fly behavior or bioluminescence model.','annotationSource':'https://github.com/flyconnectome/flywire_annotations','source':'https://github.com/philshiu/Drosophila_brain_model','license':'MIT model code; annotation data retains FlyWire annotation attribution','delta7NT':'GLUT (actual annotation; inhibitory under Shiu convention)','sourceHashes':{f:hashlib.sha256((src/f).read_bytes()).hexdigest() for f in ['annotations.tsv','connectivity.parquet']}}
data={'groups':groups,'nodes':nodes,'offsets':offsets,'targets':targets,'weights':weights,'rawSynapseCounts':raw,'measured':kinds,'meta':meta};p=out/'circuit-data.json';p.write_text(json.dumps(data,separators=(',',':')),encoding='utf-8');shutil.copyfile(src/'LICENSE',out/'SHIU-MIT-LICENSE.txt');print('bytes',p.stat().st_size,meta);assert p.stat().st_size<120000
