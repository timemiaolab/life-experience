/** Re-pretty-print data/graph.json with stable key/id ordering. */
import { loadGraph, saveGraph } from './lib/graph-io.ts';

const g = loadGraph();
saveGraph(g);
console.log(`wrote data/graph.json (${g.nodes.length} nodes, ${g.links.length} links, ${g.contributions.length} contributors)`);
