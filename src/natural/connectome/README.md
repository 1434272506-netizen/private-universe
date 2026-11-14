# Neural fireflies: provenance and scope

This is a small, biologically inspired HYBRID controller, not a scientific reproduction of a fly brain or a claim that fruit flies possess bioluminescence. The 80 beetle bodies are artistic embodiments of independent circuit states.

## Reproducible data

`circuit-data.json` is 51,863 bytes. 262 real root IDs and cell-type/hemibrain/side/neurotransmitter annotations come from `flyconnectome/flywire_annotations`, Supplemental_file1_neuron_annotations.tsv. Actual FlyWire v783 counts come from `philshiu/Drosophila_brain_model/Connectivity_783.parquet`. Only completed cells in Completeness_783.csv are considered. For each selected neuron the strongest four induced outgoing edges are retained; the ratios of their synapse counts are retained under per-neuron normalization. Each edge has a rawSynapseCounts and measured flag. 605 edges are measured; 844 are explicitly modeled routing supplements. Source SHA-256 values live in metadata. No full data is shipped to browsers.

The extraction script is `scripts/build-neural-circuit.py`; it reads offline source files under work/connectome-source (ignored by Git), and requires Python/pyarrow only to REBUILD the tiny static graph, never to run the garden. All types retain their real names; functional groups such as uPN are controller labels. Delta7 in these annotations is GLUT, not GABA. No neurotransmitter is silently relabeled. ACH sources have positive edges; GABA/GLUT sources negative edges, following Shiu's model convention (which simplifies real glutamate receptor diversity).

## Equations and time

All voltages in mV, simulation time in ms: dv/dt = (V_rest - v + g + external)/20; dg/dt = -g/5. Rest/reset -52, threshold -45, refractory 2.2ms. Forward-Euler 1ms steps quantize refractory release to a grid. Background events use a seeded Bernoulli discretization of 8Hz Poisson noise. Spike transfer is synchronous, without the original model's extra 1.8ms delay. Six steps per visual frame (four following >3ms work) intentionally slow biological simulation time. No unbounded catch-up, workers, downloads or Python runtime are needed. CSR and solver state use preallocated typed arrays; diagnostic snapshots allocate only on request.

LC10 and ORN inputs enter membranes; heading is read ONLY from smoothed DNa02 spike-rate differences. PFL3, uPN/MBON and compass circuits include measured edges and transparent modeled routing; they are not claimed to reproduce full-brain navigation. Eight compass-column inputs encode heading. LC4 takes forward terrain/obstacle and pointer alarms. A separate geometric safety layer rejects unsafe motion regardless of spikes, and is labeled as engineering collision protection, not neural intelligence.

PDF_Clock, Octopamine and Bioluminescence are 24 virtual nodes. Their ACH tags denote positive simulation stand-ins, not measured transmitter annotations. The photophore circuit and clock pulse windows are an artistic extension; burst input and neural firing drive a fast-rise/slow-decay light envelope, never a sinusoidal brightness animation. Day rests; reduced motion and covered scenes freeze state. Bodies are six instanced meshes plus 80 soft tail sprites.

## Attribution

Shiu et al., A Drosophila computational brain model reveals sensorimotor processing (Nature 2024), https://github.com/philshiu/Drosophila_brain_model (model MIT license copied verbatim in SHIU-MIT-LICENSE.txt). FlyWire annotation source: https://github.com/flyconnectome/flywire_annotations (Schlegel and FlyWire contributors; source data attribution retained, MIT code license is not asserted to relicense annotation data). eonsystemspbc/fly-brain was consulted for context only; its GPL code was not copied. The LIF equations and constants are independently implemented in JavaScript.
