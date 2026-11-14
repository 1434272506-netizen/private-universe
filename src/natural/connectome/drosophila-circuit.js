// Shiu et al. Nature 2024 LIF constants, milliseconds and millivolts.
import graph from './circuit-data.json' with {type:'json'};
export const LIF=Object.freeze({dt:1,tau_m:20,V_rest:-52,V_reset:-52,V_thresh:-45,t_ref:2.2,tau_syn:5});
export function createCircuit(){return {offsets:new Int32Array(graph.offsets),targets:new Int32Array(graph.targets),weights:new Float32Array(graph.weights),groups:graph.groups,meta:{...graph.meta,parameters:LIF}};}
