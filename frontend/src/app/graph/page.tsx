'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as THREE from 'three';
import ReactFlow, {
  Background,
  useReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  Node,
  Edge,
  NodeProps,
  Connection,
  addEdge,
  Controls,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dynamic from 'next/dynamic';
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });
import {
  Search, Plus, Minus, Filter, X, Edit3, Trash2, Link2, ChevronRight, ChevronDown,
  Maximize2, ZapOff, LayoutGrid, Share2, Eye, Layers, Activity, Grid, Disc, Compass, Play, Square, Save, RotateCcw, Sparkles
} from 'lucide-react';
import AppShell from '@/components/layout/AppShell';
import Button from '@/components/ui/Button';
// @ts-ignore
import ModelViewer from '@/components/ui/ModelViewer';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Spinner from '@/components/ui/Spinner';
import { cn, getEntityColor, getEntityBgColor } from '@/lib/utils';
import { useDialog } from '@/context/DialogContext';
import { entityApi, relationshipApi, documentApi } from '@/lib/api';
import { Entity, Relationship, EntityType, Document, ENTITY_TYPES, RELATIONSHIP_TYPES } from '@/types';

/* ─── Custom Node ────────────────────────────────────────────── */
function EntityNode({ data, selected }: NodeProps) {
  const isCluster = data.isCluster;
  const isDimmed = data.isDimmed;
  
  if (isCluster) {
    const color = getEntityColor(data.clusterType);
    return (
      <div
        className={cn(
          'relative cursor-pointer transition-all duration-300 border-2 border-dashed bg-[#151525]/90 rounded-xl p-4 shadow-xl text-center min-w-[140px]',
          selected ? 'ring-2 ring-accent' : 'hover:border-white/50',
          isDimmed ? 'opacity-35' : 'opacity-100'
        )}
        style={{ borderColor: color }}
      >
        <Handle type="target" position={Position.Top} className="opacity-0 hover:opacity-100" />
        
        {/* Layered stack effect */}
        <div className="absolute inset-0 bg-[#12121a]/60 rounded-xl border border-white/5 -translate-y-1.5 translate-x-1.5 -z-10" />
        <div className="absolute inset-0 bg-[#12121a]/30 rounded-xl border border-white/5 -translate-y-3 translate-x-3 -z-20" />
        
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#a0a0b0]">Cluster</span>
          <span className="text-sm font-bold text-white whitespace-nowrap">{data.name}</span>
          <span className="text-[10px] text-accent mt-1">{data.count} nodes collapsed</span>
        </div>
        <Handle type="source" position={Position.Bottom} className="opacity-0 hover:opacity-100" />
      </div>
    );
  }

  const color = getEntityColor(data.type);
  const bgColor = getEntityBgColor(data.type);

  return (
    <div
      className={cn(
        'relative group cursor-pointer transition-all duration-300',
        selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-[#0a0a0f] z-10' : 'hover:ring-1 hover:ring-white/50',
        isDimmed ? 'opacity-35' : 'opacity-100'
      )}
      style={{
        background: 'rgba(18, 18, 26, 0.9)',
        border: `1px solid ${color}`,
        borderRadius: '8px',
        padding: '10px 16px',
        minWidth: '120px',
        textAlign: 'center',
      }}
    >
      <Handle type="target" position={Position.Top} className="opacity-0 group-hover:opacity-100" />
      <div className="flex flex-col items-center gap-1.5">
        <Badge variant="entity" entityType={data.type as EntityType} className="scale-75 origin-center">
          {data.type}
        </Badge>
        <span className="text-sm font-semibold text-white whitespace-nowrap">{data.name}</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0 group-hover:opacity-100" />
    </div>
  );
}

/* ─── Searchable Select ──────────────────────────────────────── */
function SearchableEntitySelect({ 
  label, 
  value, 
  onChange, 
  entities 
}: { 
  label: string; 
  value: string; 
  onChange: (val: string) => void; 
  entities: Entity[];
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  
  const selectedEntity = entities.find(e => e.id === value);
  const filtered = entities.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.type.toLowerCase().includes(search.toLowerCase())).slice(0, 50);

  return (
    <div className="space-y-1.5 relative">
      <label className="block text-sm font-medium text-[#a0a0b0]">{label}</label>
      <div 
        className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white flex justify-between items-center cursor-pointer hover:border-[#3a3a4e]"
        onClick={() => setOpen(!open)}
      >
        <span className="truncate pr-4">{selectedEntity ? `${selectedEntity.name} (${selectedEntity.type})` : 'Select entity...'}</span>
        <ChevronDown className="w-4 h-4 text-[#6b6b7b] shrink-0" />
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a2e] border border-[#2a2a3e] rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-[#2a2a3e]">
            <input 
              type="text" 
              placeholder="Search entities..." 
              value={search}
              autoFocus
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff79c6]"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(e => (
              <div 
                key={e.id} 
                className="px-3 py-2 hover:bg-[#2a2a3e] cursor-pointer text-sm text-white truncate"
                onClick={() => { onChange(e.id); setOpen(false); setSearch(''); }}
              >
                {e.name} <span className="text-[#6b6b7b] text-xs ml-1">({e.type})</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[#6b6b7b] text-sm">No entities found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const cachedSphereGeo = new THREE.SphereGeometry(1, 16, 16);
const materialCache: Record<string, THREE.MeshStandardMaterial> = {};
const getStandardMaterial = (color: string, isHighlighted: boolean) => {
  const opacity = isHighlighted ? 0.85 : 0.15;
  const emissiveIntensity = isHighlighted ? 0.75 : 0.15;
  const key = `${color}-${opacity}-${emissiveIntensity}`;
  if (!materialCache[key]) {
    materialCache[key] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      emissive: new THREE.Color(color),
      emissiveIntensity: emissiveIntensity,
      metalness: 0.9,
      roughness: 0.1,
      transparent: true,
      opacity: opacity
    });
  }
  return materialCache[key];
};

const nodeTypes = {
  entity: EntityNode,
};

export default function GraphPage() {
  return (
    <ReactFlowProvider>
      <GraphPageContent />
    </ReactFlowProvider>
  );
}

function GraphPageContent() {
  const router = useRouter();
  const { confirm, alert, showToast } = useDialog();
  const { setCenter, zoomIn, zoomOut, fitView } = useReactFlow();
  
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocumentFilter, setSelectedDocumentFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkingState, setLinkingState] = useState(false);

  // Force graph ref and hover state
  const fgRef = useRef<any>(null);
  const [hoveredNode, setHoveredNode] = useState<any | null>(null);

  // View state & layouts
  const [viewMode, setViewMode] = useState<'flow' | 'network' | 'network3d'>('flow');
  const [showRelationshipFlow, setShowRelationshipFlow] = useState(false);
  const [animateEdges, setAnimateEdges] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [activeRelFilters, setActiveRelFilters] = useState<Set<string>>(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  const [isLayoutDirty, setIsLayoutDirty] = useState(false);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(ENTITY_TYPES as readonly string[]));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const allTypes = useMemo(() => {
    const types = new Set<string>();
    ENTITY_TYPES.forEach(t => types.add(t));
    entities.forEach(e => types.add(e.type));
    return Array.from(types).sort();
  }, [entities]);

  const allRelationshipTypes = useMemo(() => {
    const types = new Set<string>();
    relationships.forEach(r => {
      if (r.type) types.add(r.type);
    });
    return Array.from(types).sort();
  }, [relationships]);

  // Auto-enable any new types that the LLM hallucinated
  useEffect(() => {
    setActiveFilters(prev => {
      let changed = false;
      const next = new Set(prev);
      entities.forEach(e => {
        if (!next.has(e.type)) {
          next.add(e.type);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [entities]);

  // Selection
  const [selectedEntity, setSelectedEntity] = useState<any | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Modals
  const [addEntityOpen, setAddEntityOpen] = useState(false);
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [editEntityOpen, setEditEntityOpen] = useState(false);

  // Forms
  const [entityForm, setEntityForm] = useState({ name: '', type: 'Plant' as EntityType, description: '' });
  const [relForm, setRelForm] = useState({ source_id: '', target_id: '', type: 'related_to', description: '' });
  const [submitting, setSubmitting] = useState(false);

  const toggleCollapse = useCallback((type: string) => {
    setCollapsedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Compute Focus Mode nodes and edges (supporting selected entity or hovered node)
  const { highlightedNodes, highlightedEdges } = useMemo(() => {
    const nodesSet = new Set<string>();
    const edgesSet = new Set<string>();
    
    let focusId: string | null = null;
    if (hoveredNode) {
      focusId = hoveredNode.id?.toString();
    } else if (selectedEntity && !selectedEntity.isCluster) {
      focusId = selectedEntity.id?.toString();
    }

    if (focusId) {
      nodesSet.add(focusId);
      relationships.forEach(r => {
        const srcStr = r.source_id.toString();
        const tgtStr = r.target_id.toString();
        if (srcStr === focusId) {
          nodesSet.add(tgtStr);
          edgesSet.add(r.id.toString());
        } else if (tgtStr === focusId) {
          nodesSet.add(srcStr);
          edgesSet.add(r.id.toString());
        }
      });
    }
    return { highlightedNodes: nodesSet, highlightedEdges: edgesSet };
  }, [selectedEntity, hoveredNode, relationships]);

  /* ── Layout Generators ─────────────────────────────────────── */
  const applyCircularLayout = useCallback(() => {
    setNodes(prev => {
      const activeNodes = prev.filter(n => !n.data?.isCluster);
      const clusterNodes = prev.filter(n => n.data?.isCluster);
      
      const radius = Math.max(300, activeNodes.length * 15);
      const angleStep = (2 * Math.PI) / Math.max(activeNodes.length, 1);
      const centerX = 400;
      const centerY = 300;
      
      const updatedActive = activeNodes.map((n, i) => ({
        ...n,
        position: {
          x: centerX + radius * Math.cos(angleStep * i),
          y: centerY + radius * Math.sin(angleStep * i)
        }
      }));

      const updatedClusters = clusterNodes.map((c, i) => {
        const clusterAngle = (2 * Math.PI * i) / Math.max(clusterNodes.length, 1);
        return {
          ...c,
          position: {
            x: centerX + (radius / 2.5) * Math.cos(clusterAngle),
            y: centerY + (radius / 2.5) * Math.sin(clusterAngle)
          }
        };
      });

      return [...updatedActive, ...updatedClusters];
    });
    setIsLayoutDirty(true);
    showToast("Circular layout preview applied", "info");
  }, [showToast, setNodes]);

  const applyHierarchicalLayout = useCallback(() => {
    setNodes(prev => {
      const incomingCount: Record<string, number> = {};
      const outgoingConnections: Record<string, string[]> = {};
      
      prev.forEach(n => {
        incomingCount[n.id] = 0;
        outgoingConnections[n.id] = [];
      });
      
      edges.forEach(e => {
        if (incomingCount[e.target] !== undefined) {
          incomingCount[e.target]++;
        }
        if (outgoingConnections[e.source] !== undefined) {
          outgoingConnections[e.source].push(e.target);
        }
      });
      
      const ranks: Record<string, number> = {};
      const queue: string[] = [];
      
      prev.forEach(n => {
        if (incomingCount[n.id] === 0) {
          ranks[n.id] = 0;
          queue.push(n.id);
        }
      });
      
      if (queue.length === 0 && prev.length > 0) {
        ranks[prev[0].id] = 0;
        queue.push(prev[0].id);
      }
      
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentRank = ranks[currentId];
        
        const neighbors = outgoingConnections[currentId] || [];
        neighbors.forEach(neighborId => {
          if (ranks[neighborId] === undefined) {
            ranks[neighborId] = currentRank + 1;
            queue.push(neighborId);
          } else {
            ranks[neighborId] = Math.max(ranks[neighborId], currentRank + 1);
          }
        });
      }
      
      const rankGroups: Record<number, string[]> = {};
      prev.forEach(n => {
        const r = ranks[n.id] !== undefined ? ranks[n.id] : 0;
        if (!rankGroups[r]) rankGroups[r] = [];
        rankGroups[r].push(n.id);
      });
      
      const updatedNodes = prev.map(n => {
        const r = ranks[n.id] !== undefined ? ranks[n.id] : 0;
        const group = rankGroups[r];
        const index = group.indexOf(n.id);
        
        const xSpacing = 220;
        const ySpacing = 160;
        const totalWidth = (group.length - 1) * xSpacing;
        
        return {
          ...n,
          position: {
            x: (index * xSpacing) - (totalWidth / 2) + 400,
            y: r * ySpacing + 100
          }
        };
      });
      
      return updatedNodes;
    });
    setIsLayoutDirty(true);
    showToast("Hierarchical layout applied", "info");
  }, [edges, showToast, setNodes]);

  const applyHorizontalLayout = useCallback(() => {
    setNodes(prev => {
      const incomingCount: Record<string, number> = {};
      const outgoingConnections: Record<string, string[]> = {};
      
      prev.forEach(n => {
        incomingCount[n.id] = 0;
        outgoingConnections[n.id] = [];
      });
      
      edges.forEach(e => {
        if (incomingCount[e.target] !== undefined) {
          incomingCount[e.target]++;
        }
        if (outgoingConnections[e.source] !== undefined) {
          outgoingConnections[e.source].push(e.target);
        }
      });
      
      const ranks: Record<string, number> = {};
      const queue: string[] = [];
      
      prev.forEach(n => {
        if (incomingCount[n.id] === 0) {
          ranks[n.id] = 0;
          queue.push(n.id);
        }
      });
      
      if (queue.length === 0 && prev.length > 0) {
        ranks[prev[0].id] = 0;
        queue.push(prev[0].id);
      }
      
      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const currentRank = ranks[currentId];
        
        const neighbors = outgoingConnections[currentId] || [];
        neighbors.forEach(neighborId => {
          if (ranks[neighborId] === undefined) {
            ranks[neighborId] = currentRank + 1;
            queue.push(neighborId);
          } else {
            ranks[neighborId] = Math.max(ranks[neighborId], currentRank + 1);
          }
        });
      }
      
      const rankGroups: Record<number, string[]> = {};
      prev.forEach(n => {
        const r = ranks[n.id] !== undefined ? ranks[n.id] : 0;
        if (!rankGroups[r]) rankGroups[r] = [];
        rankGroups[r].push(n.id);
      });
      
      const updatedNodes = prev.map(n => {
        const r = ranks[n.id] !== undefined ? ranks[n.id] : 0;
        const group = rankGroups[r];
        const index = group.indexOf(n.id);
        
        const xSpacing = 240;
        const ySpacing = 140;
        const totalHeight = (group.length - 1) * ySpacing;
        
        return {
          ...n,
          position: {
            x: r * xSpacing + 100,
            y: (index * ySpacing) - (totalHeight / 2) + 300
          }
        };
      });
      
      return updatedNodes;
    });
    setIsLayoutDirty(true);
    showToast("Horizontal flow layout applied", "info");
  }, [edges, showToast, setNodes]);

  const applyRadialLayout = useCallback(() => {
    setNodes(prev => {
      if (prev.length === 0) return prev;
      
      let centerNodeId = selectedEntity?.id?.toString() || "";
      if (!centerNodeId || !prev.find(n => n.id === centerNodeId)) {
        const degrees: Record<string, number> = {};
        prev.forEach(n => { degrees[n.id] = 0; });
        edges.forEach(e => {
          if (degrees[e.source] !== undefined) degrees[e.source]++;
          if (degrees[e.target] !== undefined) degrees[e.target]++;
        });
        let maxDegree = -1;
        prev.forEach(n => {
          if (degrees[n.id] > maxDegree) {
            maxDegree = degrees[n.id];
            centerNodeId = n.id;
          }
        });
      }
      
      const distances: Record<string, number> = {};
      distances[centerNodeId] = 0;
      
      const adjList: Record<string, string[]> = {};
      prev.forEach(n => { adjList[n.id] = []; });
      edges.forEach(e => {
        if (adjList[e.source] !== undefined && adjList[e.target] !== undefined) {
          adjList[e.source].push(e.target);
          adjList[e.target].push(e.source);
        }
      });
      
      const queue = [centerNodeId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const dist = distances[curr];
        adjList[curr].forEach(neigh => {
          if (distances[neigh] === undefined) {
            distances[neigh] = dist + 1;
            queue.push(neigh);
          }
        });
      }
      
      const distanceGroups: Record<number, string[]> = {};
      prev.forEach(n => {
        const d = distances[n.id] !== undefined ? distances[n.id] : 4;
        if (!distanceGroups[d]) distanceGroups[d] = [];
        distanceGroups[d].push(n.id);
      });
      
      const centerX = 400;
      const centerY = 300;
      
      const updatedNodes = prev.map(n => {
        const d = distances[n.id] !== undefined ? distances[n.id] : 4;
        if (d === 0) {
          return {
            ...n,
            position: { x: centerX, y: centerY }
          };
        }
        
        const group = distanceGroups[d];
        const index = group.indexOf(n.id);
        const angle = (2 * Math.PI * index) / Math.max(group.length, 1);
        const ringRadius = d * 180;
        
        return {
          ...n,
          position: {
            x: centerX + ringRadius * Math.cos(angle),
            y: centerY + ringRadius * Math.sin(angle)
          }
        };
      });
      
      return updatedNodes;
    });
    setIsLayoutDirty(true);
    showToast("Radial layout applied", "info");
  }, [edges, selectedEntity, showToast, setNodes]);

  const applyGridLayout = useCallback(() => {
    setNodes(prev => {
      const groups: Record<string, typeof prev> = {};
      prev.forEach(n => {
        const type = n.data?.isCluster ? 'Cluster' : (n.data?.type || 'General');
        if (!groups[type]) groups[type] = [];
        groups[type].push(n);
      });
      
      const updatedNodes: typeof prev = [];
      let col = 0;
      const colWidth = 280;
      const rowHeight = 110;
      
      Object.keys(groups).sort().forEach(type => {
        groups[type].forEach((n, row) => {
          updatedNodes.push({
            ...n,
            position: {
              x: col * colWidth,
              y: row * rowHeight
            }
          });
        });
        col++;
      });
      
      return updatedNodes;
    });
    setIsLayoutDirty(true);
    showToast("Grid layout preview applied", "info");
  }, [showToast, setNodes]);

  const applyForceLayoutPreview = useCallback(() => {
    const activeNodes = nodes.filter(n => !n.data?.isCluster);
    const clusterNodes = nodes.filter(n => n.data?.isCluster);
    const allLayoutNodes = [...activeNodes, ...clusterNodes];

    const tempNodes = allLayoutNodes.map(n => ({ id: n.id, x: n.position.x, y: n.position.y }));
    const tempLinks = edges.map(e => ({ source: e.source, target: e.target }));
    
    const width = 800;
    const height = 600;
    const k = Math.sqrt((width * height) / Math.max(tempNodes.length, 1));
    
    const forceAttractive = (dist: number) => (dist * dist) / k;
    const forceRepelling = (dist: number) => (k * k) / dist;
    
    const iterations = 120;
    const positions: Record<string, { x: number, y: number }> = {};
    tempNodes.forEach(n => {
      positions[n.id] = { x: n.x || 0, y: n.y || 0 };
    });
    
    for (let iter = 0; iter < iterations; iter++) {
      const displacement: Record<string, { dx: number, dy: number }> = {};
      tempNodes.forEach(n => { displacement[n.id] = { dx: 0, dy: 0 }; });
      
      for (let i = 0; i < tempNodes.length; i++) {
        const n1 = tempNodes[i];
        for (let j = i + 1; j < tempNodes.length; j++) {
          const n2 = tempNodes[j];
          const dx = positions[n1.id].x - positions[n2.id].x;
          const dy = positions[n1.id].y - positions[n2.id].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 400) {
            const f = forceRepelling(dist);
            displacement[n1.id].dx += (dx / dist) * f;
            displacement[n1.id].dy += (dy / dist) * f;
            displacement[n2.id].dx -= (dx / dist) * f;
            displacement[n2.id].dy -= (dy / dist) * f;
          }
        }
      }
      
      tempLinks.forEach(l => {
        const n1 = l.source;
        const n2 = l.target;
        if (positions[n1] && positions[n2]) {
          const dx = positions[n1].x - positions[n2].x;
          const dy = positions[n1].y - positions[n2].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const f = forceAttractive(dist);
          displacement[n1].dx -= (dx / dist) * f;
          displacement[n1].dy -= (dy / dist) * f;
          displacement[n2].dx += (dx / dist) * f;
          displacement[n2].dy += (dy / dist) * f;
        }
      });
      
      const gravity = 0.04;
      tempNodes.forEach(n => {
        const dx = 400 - positions[n.id].x;
        const dy = 300 - positions[n.id].y;
        displacement[n.id].dx += dx * gravity;
        displacement[n.id].dy += dy * gravity;
      });
      
      const tempFactor = (iterations - iter) / iterations;
      const maxDisplacement = 40 * tempFactor;
      tempNodes.forEach(n => {
        const dx = displacement[n.id].dx;
        const dy = displacement[n.id].dy;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const clipDist = Math.min(dist, maxDisplacement);
        positions[n.id].x += (dx / dist) * clipDist;
        positions[n.id].y += (dy / dist) * clipDist;
      });
    }
    
    setNodes(prev => prev.map(n => {
      const pos = positions[n.id];
      return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
    }));
    setIsLayoutDirty(true);
    showToast("Force layout simulation preview applied", "info");
  }, [nodes, edges, setNodes, showToast]);

  const handleSaveLayout = async () => {
    setSubmitting(true);
    try {
      await Promise.all(nodes.filter(n => !n.data?.isCluster).map(node => {
        const entity = node.data as Entity;
        const newProperties = { ...entity.properties, ui_x: node.position.x, ui_y: node.position.y };
        return entityApi.update(entity.id, {
          name: entity.name,
          type: entity.type,
          description: entity.description,
          properties: newProperties,
        });
      }));
      
      setEntities(prev => prev.map(e => {
        const matchingNode = nodes.find(n => n.id === e.id.toString());
        if (matchingNode) {
          return {
            ...e,
            properties: { ...e.properties, ui_x: matchingNode.position.x, ui_y: matchingNode.position.y }
          };
        }
        return e;
      }));
      setIsLayoutDirty(false);
      showToast("Layout coordinates saved to database", "success");
    } catch (err) {
      console.error("Failed to save layout:", err);
      showToast("Failed to save layout coordinates", "error");
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleResetLayout = useCallback(() => {
    setNodes(prev => prev.map(n => {
      if (n.data?.isCluster) return n;
      const entity = entities.find(e => e.id.toString() === n.id);
      if (entity && entity.properties && entity.properties.ui_x !== undefined && entity.properties.ui_y !== undefined) {
        return {
          ...n,
          position: { x: entity.properties.ui_x, y: entity.properties.ui_y }
        };
      }
      return n;
    }));
    setIsLayoutDirty(false);
    showToast("Layout coordinates reset", "info");
  }, [entities, setNodes, showToast]);

  /* ── Fetch data ──────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entRes, relRes, docRes] = await Promise.all([
        entityApi.list({ limit: 1000 }),
        relationshipApi.list({ limit: 1000 }),
        documentApi.list(),
      ]);
      setEntities(entRes.data.items || entRes.data);
      const rels = relRes.data.items || relRes.data;
      setRelationships(rels);
      setDocuments(docRes.data.items || docRes.data);
      setActiveRelFilters(prev => {
        const next = new Set(prev);
        rels.forEach((r: any) => {
          if (r.type) next.add(r.type);
        });
        // If it was completely empty (e.g. first load), make sure all loaded types are active
        if (prev.size === 0) {
          rels.forEach((r: any) => {
            if (r.type) next.add(r.type);
          });
        }
        return next;
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAutoLink = useCallback(async () => {
    setLinkingState(true);
    try {
      const res = await relationshipApi.autoLink();
      const count = res.data.linked_count || 0;
      if (count > 0) {
        showToast(`Auto-Link successful: logically linked ${count} relationship(s).`, "success");
        await alert({
          title: "Relationship Sorting Complete",
          message: `Successfully analyzed the graph and created ${count} logical relationship(s) between entities.`,
          type: "success"
        });
      } else {
        showToast("Auto-Link finished: no orphan relationships resolved.", "info");
        await alert({
          title: "Relationship Sorting Complete",
          message: "No new logical relationships could be resolved among the existing orphan entities at this time.",
          type: "info"
        });
      }
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || "Failed to sort relationships automatically", "error");
      await alert({
        title: "Sorting Failed",
        message: err.response?.data?.detail || "Failed to sort relationships automatically. Please check your Ollama status and settings.",
        type: "error"
      });
    } finally {
      setLinkingState(false);
    }
  }, [fetchData, showToast, alert]);

  // Memoized graph data structure for ForceGraph2D to prevent simulation resets/jitter
  const networkGraphData = useMemo(() => {
    const filteredRels = relationships.filter(r => {
      if (!activeRelFilters.has(r.type)) return false;
      if (selectedDocumentFilter !== 'all') {
        const docIdStr = selectedDocumentFilter.toString();
        return r.source_evidence && r.source_evidence.map(String).includes(docIdStr);
      }
      return true;
    });

    const docConnectedEntityIds = new Set<string>();
    if (selectedDocumentFilter !== 'all') {
      filteredRels.forEach(r => {
        docConnectedEntityIds.add(r.source_id.toString());
        docConnectedEntityIds.add(r.target_id.toString());
      });
    }

    const visibleEntities = entities.filter(e => {
      if (!activeFilters.has(e.type)) return false;
      if (selectedDocumentFilter !== 'all') {
        const docIdStr = selectedDocumentFilter.toString();
        const matchesDoc = e.source_document_id?.toString() === docIdStr;
        const isConnected = docConnectedEntityIds.has(e.id.toString());
        return matchesDoc || isConnected;
      }
      return true;
    });
    
    const collapsedGroups: Record<string, Entity[]> = {};
    const individualEntities: Entity[] = [];
    visibleEntities.forEach(e => {
      if (collapsedTypes.has(e.type)) {
        if (!collapsedGroups[e.type]) collapsedGroups[e.type] = [];
        collapsedGroups[e.type].push(e);
      } else {
        individualEntities.push(e);
      }
    });

    const fgNodes: any[] = [];
    const entityToNodeIdMap: Record<string, string> = {};

    individualEntities.forEach((e, idx) => {
      entityToNodeIdMap[e.id] = e.id.toString();
      const hasPos = e.properties && e.properties.ui_x !== undefined && e.properties.ui_y !== undefined;
      const angle = (2 * Math.PI * idx) / Math.max(individualEntities.length, 1);
      const radius = Math.max(250, visibleEntities.length * 12);
      
      fgNodes.push({
        id: e.id.toString(),
        name: e.name,
        type: e.type,
        count: 1,
        isCluster: false,
        x: hasPos ? e.properties.ui_x : (radius * Math.cos(angle)),
        y: hasPos ? e.properties.ui_y : (radius * Math.sin(angle))
      });
    });

    Object.keys(collapsedGroups).forEach((type, idx) => {
      const clusterNodeId = `cluster-${type}`;
      const groupEntities = collapsedGroups[type];
      groupEntities.forEach(e => {
        entityToNodeIdMap[e.id] = clusterNodeId;
      });

      let sumX = 0, sumY = 0, countPos = 0;
      groupEntities.forEach(e => {
        if (e.properties && e.properties.ui_x !== undefined && e.properties.ui_y !== undefined) {
          sumX += e.properties.ui_x;
          sumY += e.properties.ui_y;
          countPos++;
        }
      });

      const posX = countPos > 0 ? sumX / countPos : (180 * Math.cos((2 * Math.PI * idx) / 4));
      const posY = countPos > 0 ? sumY / countPos : (180 * Math.sin((2 * Math.PI * idx) / 4));

      fgNodes.push({
        id: clusterNodeId,
        name: `${type}s`,
        type: type,
        count: groupEntities.length,
        isCluster: true,
        x: posX,
        y: posY
      });
    });

    const rawEdges = filteredRels.filter(
      (r) => entityToNodeIdMap[r.source_id] !== undefined && entityToNodeIdMap[r.target_id] !== undefined
    );

    const edgeKeyMap: Record<string, { id: string, source: string, target: string, label: string }> = {};
    rawEdges.forEach(r => {
      const sourceNodeId = entityToNodeIdMap[r.source_id];
      const targetNodeId = entityToNodeIdMap[r.target_id];
      if (sourceNodeId === targetNodeId) return;

      const key = `${sourceNodeId}->${targetNodeId}`;
      if (!edgeKeyMap[key]) {
        edgeKeyMap[key] = {
          id: r.id.toString(),
          source: sourceNodeId,
          target: targetNodeId,
          label: r.type.replace(/_/g, ' ')
        };
      }
    });

    return {
      nodes: fgNodes,
      links: Object.values(edgeKeyMap)
    };
  }, [entities, relationships, activeFilters, collapsedTypes, activeRelFilters, selectedDocumentFilter]);

  // Adjust D3 force settings to space out nodes in Network View
  useEffect(() => {
    if ((viewMode === 'network' || viewMode === 'network3d') && fgRef.current) {
      const charge = fgRef.current.d3Force('charge');
      if (charge) {
        charge.strength(viewMode === 'network3d' ? -800 : -300); // Much stronger repulsion in 3D to prevent clumping
      }
      const link = fgRef.current.d3Force('link');
      if (link) {
        link.distance(viewMode === 'network3d' ? 240 : 140); // Spaced out link distance in 3D
      }
      
      const center = fgRef.current.d3Force('center');
      if (center) {
        center.x(0);
        center.y(0);
      }
      
      fgRef.current.d3ReheatSimulation();
    }
  }, [viewMode, networkGraphData]);

  // Search-Centric Locate & Zoom Focus
  useEffect(() => {
    if (searchQuery.trim()) {
      const bestMatch = entities.find(e => 
        activeFilters.has(e.type) && 
        e.name.toLowerCase() === searchQuery.toLowerCase().trim()
      ) || entities.find(e => 
        activeFilters.has(e.type) && 
        e.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
      );
      
      if (bestMatch && !collapsedTypes.has(bestMatch.type)) {
        setSelectedEntity(bestMatch);
        setDetailPanelOpen(true);
      }
    }
  }, [searchQuery, entities, activeFilters, collapsedTypes]);

  useEffect(() => {
    if (selectedEntity && !selectedEntity.isCluster) {
      const nodeX = selectedEntity.properties?.ui_x;
      const nodeY = selectedEntity.properties?.ui_y;
      if (nodeX !== undefined && nodeY !== undefined) {
        setCenter(nodeX, nodeY, { zoom: 1.4, duration: 800 });
      }
    }
  }, [selectedEntity, setCenter]);

  /* ── Build graph elements ─────────────────────────────────── */
  useEffect(() => {
    const filteredRels = relationships.filter(r => {
      if (!activeRelFilters.has(r.type)) return false;
      if (selectedDocumentFilter !== 'all') {
        const docIdStr = selectedDocumentFilter.toString();
        return r.source_evidence && r.source_evidence.map(String).includes(docIdStr);
      }
      return true;
    });

    const docConnectedEntityIds = new Set<string>();
    if (selectedDocumentFilter !== 'all') {
      filteredRels.forEach(r => {
        docConnectedEntityIds.add(r.source_id.toString());
        docConnectedEntityIds.add(r.target_id.toString());
      });
    }

    const visibleEntities = entities.filter(
      (e) => {
        if (!activeFilters.has(e.type)) return false;
        if (searchQuery !== '' && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        if (selectedDocumentFilter !== 'all') {
          const docIdStr = selectedDocumentFilter.toString();
          const matchesDoc = e.source_document_id?.toString() === docIdStr;
          const isConnected = docConnectedEntityIds.has(e.id.toString());
          return matchesDoc || isConnected;
        }
        return true;
      }
    );

    const collapsedGroups: Record<string, Entity[]> = {};
    const individualEntities: Entity[] = [];

    visibleEntities.forEach(e => {
      if (collapsedTypes.has(e.type)) {
        if (!collapsedGroups[e.type]) collapsedGroups[e.type] = [];
        collapsedGroups[e.type].push(e);
      } else {
        individualEntities.push(e);
      }
    });

    const newNodes: Node[] = [];
    const entityToNodeIdMap: Record<string, string> = {};

    individualEntities.forEach((e, idx) => {
      entityToNodeIdMap[e.id] = e.id.toString();
      const hasPos = e.properties && e.properties.ui_x !== undefined && e.properties.ui_y !== undefined;
      const isDimmed = selectedEntity && !highlightedNodes.has(e.id.toString());
      const angle = (2 * Math.PI * idx) / Math.max(individualEntities.length, 1);
      const radius = Math.max(250, visibleEntities.length * 12);
      
      newNodes.push({
        id: e.id.toString(),
        type: 'entity',
        position: {
          x: hasPos ? e.properties.ui_x : (400 + radius * Math.cos(angle)),
          y: hasPos ? e.properties.ui_y : (300 + radius * Math.sin(angle)),
        },
        data: {
          ...e,
          isDimmed,
          isSelected: selectedEntity && selectedEntity.id === e.id,
        },
        style: {
          opacity: isDimmed ? 0.35 : 1,
          transition: 'opacity 0.2s ease',
        }
      });
    });

    Object.keys(collapsedGroups).forEach((type, idx) => {
      const clusterNodeId = `cluster-${type}`;
      const groupEntities = collapsedGroups[type];
      
      groupEntities.forEach(e => {
        entityToNodeIdMap[e.id] = clusterNodeId;
      });

      let sumX = 0, sumY = 0, countPos = 0;
      groupEntities.forEach(e => {
        if (e.properties && e.properties.ui_x !== undefined && e.properties.ui_y !== undefined) {
          sumX += e.properties.ui_x;
          sumY += e.properties.ui_y;
          countPos++;
        }
      });

      const posX = countPos > 0 ? sumX / countPos : (400 + 180 * Math.cos((2 * Math.PI * idx) / 4));
      const posY = countPos > 0 ? sumY / countPos : (300 + 180 * Math.sin((2 * Math.PI * idx) / 4));

      const isDimmed = selectedEntity && selectedEntity.type !== type;

      newNodes.push({
        id: clusterNodeId,
        type: 'entity',
        position: { x: posX, y: posY },
        data: {
          isCluster: true,
          clusterType: type,
          name: `${type}s`,
          count: groupEntities.length,
          isDimmed,
        },
        style: {
          opacity: isDimmed ? 0.35 : 1,
          transition: 'opacity 0.2s ease',
        }
      });
    });

    const rawEdges = filteredRels.filter(
      (r) => entityToNodeIdMap[r.source_id] !== undefined && entityToNodeIdMap[r.target_id] !== undefined
    );

    const edgeKeyMap: Record<string, { id: string, source: string, target: string, types: Set<string>, count: number }> = {};
    rawEdges.forEach(r => {
      const sourceNodeId = entityToNodeIdMap[r.source_id];
      const targetNodeId = entityToNodeIdMap[r.target_id];
      
      if (sourceNodeId === targetNodeId) return;

      const key = `${sourceNodeId}->${targetNodeId}`;
      if (!edgeKeyMap[key]) {
        edgeKeyMap[key] = {
          id: r.id.toString(),
          source: sourceNodeId,
          target: targetNodeId,
          types: new Set([r.type]),
          count: 1
        };
      } else {
        edgeKeyMap[key].types.add(r.type);
        edgeKeyMap[key].count++;
      }
    });

    const newEdges: Edge[] = Object.values(edgeKeyMap).map(e => {
      const edgeTypesLabel = Array.from(e.types).map(t => t.replace(/_/g, ' ')).join(', ');
      const label = e.count > 1 ? `${edgeTypesLabel} (x${e.count})` : edgeTypesLabel;
      const isSelected = selectedEntity && (e.source === selectedEntity.id.toString() || e.target === selectedEntity.id.toString());
      const isDimmed = selectedEntity && !isSelected;
      const hasLabel = showEdgeLabels || isSelected;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        label: hasLabel ? label : undefined,
        animated: animateEdges || isSelected,
        style: { 
          stroke: isSelected ? '#ff79c6' : '#4a4a6a', 
          strokeWidth: isSelected ? 2.5 : 1.5,
          opacity: isDimmed ? 0.25 : 1
        },
        labelStyle: { fill: isSelected ? '#ffffff' : '#a0a0b0', fontWeight: isSelected ? 700 : 500, fontSize: 10 },
        labelBgStyle: { fill: '#0a0a0f', fillOpacity: 0.8 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSelected ? '#ff79c6' : '#4a4a6a',
        },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [entities, relationships, activeFilters, searchQuery, collapsedTypes, selectedEntity, highlightedNodes, animateEdges, showEdgeLabels, activeRelFilters, selectedDocumentFilter, setNodes, setEdges]);

  /* ── Handlers ────────────────────────────────────────────── */
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedEntity(node.data as Entity);
    setDetailPanelOpen(true);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedEntity(null);
    setDetailPanelOpen(false);
  }, []);

  const onNodeDragStop = useCallback(async (_: React.MouseEvent, node: Node) => {
    // Save the new position to the database
    const entity = node.data as Entity;
    const newProperties = { ...entity.properties, ui_x: node.position.x, ui_y: node.position.y };
    try {
      await entityApi.update(entity.id, {
        name: entity.name,
        type: entity.type,
        description: entity.description,
        properties: newProperties,
      });
      // Update local entities state so it doesn't snap back on filter changes
      setEntities(prev => prev.map(e => e.id === entity.id ? { ...e, properties: newProperties } : e));
    } catch (err) {
      console.error('Failed to save node position:', err);
    }
  }, []);

  const onConnect = useCallback((params: Connection | Edge) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  const selectedConnections = useMemo(() => {
    if (!selectedEntity) return [];
    return relationships.filter(
      (r) => r.source_id === selectedEntity.id || r.target_id === selectedEntity.id
    );
  }, [selectedEntity, relationships]);

  const toggleFilter = (type: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const toggleRelFilter = (type: string) => {
    setActiveRelFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  /* ── CRUD Operations ─────────────────────────────────────── */
  const handleAddEntity = async () => {
    setSubmitting(true);
    try {
      await entityApi.create({ ...entityForm, properties: {} });
      setAddEntityOpen(false);
      setEntityForm({ name: '', type: 'Plant', description: '' });
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to create entity', "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEntity = async () => {
    if (!selectedEntity) return;
    setSubmitting(true);
    try {
      await entityApi.update(selectedEntity.id, { ...entityForm, properties: selectedEntity.properties || {} });
      setEditEntityOpen(false);
      await fetchData();
      setDetailPanelOpen(false);
      setSelectedEntity(null);
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to update entity', "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntity = async () => {
    if (!selectedEntity) return;
    const confirmed = await confirm({
      title: "Delete Entity",
      message: `Delete "${selectedEntity.name}"? This action cannot be undone.`,
      type: "destructive",
      confirmText: "Delete"
    });
    if (!confirmed) return;
    try {
      await entityApi.delete(selectedEntity.id);
      setDetailPanelOpen(false);
      setSelectedEntity(null);
      await fetchData();
      showToast(`Entity "${selectedEntity.name}" deleted successfully`, "success");
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to delete entity', "error");
    }
  };

  const handleAddRelationship = async () => {
    setSubmitting(true);
    try {
      await relationshipApi.create(relForm);
      setAddRelOpen(false);
      setRelForm({ source_id: '', target_id: '', type: 'related_to', description: '' });
      await fetchData();
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Failed to create relationship', "error");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (!selectedEntity) return;
    setEntityForm({ name: selectedEntity.name, type: selectedEntity.type, description: selectedEntity.description });
    setEditEntityOpen(true);
  };

  return (
    <AppShell>
      <div className="h-[calc(100vh-64px)] flex relative">
        {/* ── Mobile Backdrop for Left Panel ──────────────── */}
        {mobileFiltersOpen && (
          <div className="md:hidden absolute inset-0 z-20 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileFiltersOpen(false)} />
        )}

        {/* ── Left Filter Panel ───────────────────────────── */}
        <div className={cn(
          "w-[280px] max-w-[85vw] md:w-[280px] border-r border-[#2a2a3e] bg-[#0a0a0f]/95 backdrop-blur-md flex flex-col shrink-0 z-30 transition-transform duration-300 h-full",
          "absolute left-0 top-0 md:static",
          mobileFiltersOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}>
          <div className="p-4 border-b border-[#2a2a3e] relative">
            <button 
              className="md:hidden absolute top-4 right-4 text-[#6b6b7b] hover:text-white"
              onClick={() => setMobileFiltersOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff79c6] to-[#d68eff] flex items-center justify-center">
                <Share2 className="w-4 h-4 text-white" />
              </div>
              <div className="pr-8">
                <h2 className="text-sm font-semibold text-white">Knowledge Graph</h2>
                <p className="text-[10px] text-[#6b6b7b]">{entities.length} entities · {relationships.length} edges</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b7b]" />
              <input
                type="text"
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] transition-colors"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-4 border-b border-[#2a2a3e] space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Filter className="w-3.5 h-3.5 text-[#6b6b7b]" />
                <span className="text-xs font-medium text-[#a0a0b0] uppercase tracking-wider">Entity Types</span>
              </div>
              <div className="space-y-1">
                {allTypes.map((type) => {
                  const color = getEntityColor(type);
                  const count = entities.filter((e) => e.type === type).length;
                  return (
                    <div key={type} className="group flex items-center justify-between py-0.5 pr-2 hover:bg-white/[0.01] rounded-lg transition-colors">
                      <button
                        onClick={() => toggleFilter(type)}
                        className={cn(
                          'flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200',
                          activeFilters.has(type) ? 'text-white' : 'text-[#6b6b7b] hover:text-[#a0a0b0]'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
                            activeFilters.has(type) ? '' : 'opacity-40'
                          )}
                          style={{ borderColor: color, backgroundColor: activeFilters.has(type) ? `${color}33` : 'transparent' }}
                        >
                          {activeFilters.has(type) && (
                            <div className="w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
                          )}
                        </div>
                        <span className="flex-1 text-left truncate">{type}</span>
                        <span className="text-[10px] text-[#6b6b7b] tabular-nums shrink-0">{count}</span>
                      </button>
                      {activeFilters.has(type) && count > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleCollapse(type); }}
                          className={cn(
                            'p-1.5 rounded hover:bg-white/5 transition-all duration-200 shrink-0 ml-1',
                            collapsedTypes.has(type) ? 'text-accent bg-accent/10' : 'text-[#6b6b7b] hover:text-white'
                          )}
                          title={collapsedTypes.has(type) ? "Expand cluster" : "Collapse cluster"}
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-[#2a2a3e]/40">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-3.5 h-3.5 text-[#6b6b7b]" />
                <span className="text-xs font-medium text-[#a0a0b0] uppercase tracking-wider">Relationship Types</span>
              </div>
              {allRelationshipTypes.length === 0 ? (
                <div className="text-xs text-[#6b6b7b] px-3 py-2 italic">
                  No relationships present
                </div>
              ) : (
                <div className="space-y-1">
                  {allRelationshipTypes.map((type) => {
                    const count = relationships.filter((r) => r.type === type).length;
                    const isActive = activeRelFilters.has(type);
                    return (
                      <button
                        key={type}
                        onClick={() => toggleRelFilter(type)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-white/[0.01]',
                          isActive ? 'text-white' : 'text-[#6b6b7b] hover:text-[#a0a0b0]'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
                            isActive ? 'border-[#ff79c6] bg-[#ff79c6]/20' : 'border-[#4a4a6a] opacity-40'
                          )}
                        >
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-sm bg-[#ff79c6]" />
                          )}
                        </div>
                        <span className="flex-1 text-left truncate capitalize">{type.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-[#6b6b7b] tabular-nums shrink-0">{count}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="p-4 space-y-2 mt-auto">
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setEntityForm({ name: '', type: 'Plant', description: '' });
                setAddEntityOpen(true);
              }}
            >
              Add Entity
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              icon={<Link2 className="w-4 h-4" />}
              onClick={() => {
                setRelForm({ source_id: entities[0]?.id || '', target_id: entities[1]?.id || '', type: 'related_to', description: '' });
                setAddRelOpen(true);
              }}
            >
              Add Relationship
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full border-dashed border-accent/50 text-accent hover:bg-accent/10"
              icon={linkingState ? <Spinner size="sm" /> : <Sparkles className="w-4 h-4 text-accent" />}
              onClick={handleAutoLink}
              disabled={linkingState}
            >
              {linkingState ? "Sorting..." : "Sort Relations"}
            </Button>
          </div>
        </div>

        {/* ── Visualizer Controls & Canvas ───────────────── */}
        <div className="flex-1 relative bg-[#050508] overflow-hidden flex flex-col">
          {/* Glassmorphic Top Action Toolbar */}
          {!loading && !error && (
            <div 
              className="w-full p-3 bg-[#0a0a0f]/80 backdrop-blur-md border-b border-[#2a2a3e] flex flex-row items-center justify-start md:justify-between gap-3 z-20 overflow-x-auto no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`
                .no-scrollbar::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              {/* View Mode Switcher */}
              <div className="flex bg-[#12121a] border border-[#2a2a3e] rounded-xl p-1 shrink-0">
                <button
                  onClick={() => { setViewMode('flow'); setSelectedEntity(null); }}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer',
                    viewMode === 'flow' ? 'bg-[#ff79c6] text-white shadow-md' : 'text-[#888898] hover:text-white'
                  )}
                >
                  <Activity className="w-3.5 h-3.5" /> Flow View
                </button>
                <button
                  onClick={() => { setViewMode('network'); setSelectedEntity(null); }}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer',
                    viewMode === 'network' ? 'bg-[#ff79c6] text-white shadow-md' : 'text-[#888898] hover:text-white'
                  )}
                >
                  <Compass className="w-3.5 h-3.5" /> Network View
                </button>
                <button
                  onClick={() => { setViewMode('network3d'); setSelectedEntity(null); }}
                  className={cn(
                    'px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 cursor-pointer',
                    viewMode === 'network3d' ? 'bg-[#ff79c6] text-white shadow-md' : 'text-[#888898] hover:text-white'
                  )}
                >
                  <Layers className="w-3.5 h-3.5" /> 3D View
                </button>
              </div>

              {/* Document Filter Dropdown */}
              <div className="flex items-center gap-2 bg-[#12121a] border border-[#2a2a3e] rounded-xl px-3 py-1.5 z-30 shrink-0">
                <span className="text-[10px] text-[#6b6b7b] uppercase font-bold tracking-widest">Doc Filter</span>
                <select
                  value={selectedDocumentFilter}
                  onChange={(e) => {
                    setSelectedDocumentFilter(e.target.value);
                    setSelectedEntity(null);
                  }}
                  className="bg-transparent text-xs text-white border-none focus:outline-none cursor-pointer max-w-[200px]"
                >
                  <option value="all" className="bg-[#0a0a0f] text-white">All Documents</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id.toString()} className="bg-[#0a0a0f] text-white">
                      {doc.original_name || doc.filename}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Toolbar by Mode */}
              <div className="flex items-center gap-2.5 shrink-0">
                {viewMode === 'flow' ? (
                  <div className="flex items-center gap-1.5 bg-[#12121a]/85 border border-[#2a2a3e] rounded-xl p-1.5">
                    <span className="text-[10px] text-[#6b6b7b] uppercase font-bold tracking-widest px-2">Layout Tools</span>
                    <button
                      onClick={applyCircularLayout}
                      className="p-1.5 hover:bg-white/5 text-[#888898] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Circular Layout"
                    >
                      <Disc className="w-4 h-4" />
                    </button>
                    <button
                      onClick={applyHierarchicalLayout}
                      className="p-1.5 hover:bg-white/5 text-[#888898] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Hierarchical Layout (Vertical)"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={applyHorizontalLayout}
                      className="p-1.5 hover:bg-white/5 text-[#888898] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Hierarchical Layout (Horizontal)"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={applyRadialLayout}
                      className="p-1.5 hover:bg-white/5 text-[#888898] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Radial Orbit Layout"
                    >
                      <Compass className="w-4 h-4" />
                    </button>
                    <button
                      onClick={applyGridLayout}
                      className="p-1.5 hover:bg-white/5 text-[#888898] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Grid Layout"
                    >
                      <Grid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={applyForceLayoutPreview}
                      className="p-1.5 hover:bg-white/5 text-[#888898] hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Force Directed Preview"
                    >
                      <Activity className="w-4 h-4 rotate-90" />
                    </button>
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-[#888898] hover:text-white cursor-pointer select-none border-l border-[#2a2a3e] pl-2 ml-1">
                      <input
                        type="checkbox"
                        checked={animateEdges}
                        onChange={(e) => setAnimateEdges(e.target.checked)}
                        className="rounded border-[#2a2a3e] bg-[#0a0a0f] text-[#ff79c6] focus:ring-[#ff79c6] w-3 h-3 cursor-pointer"
                      />
                      Animate
                    </label>
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-[#888898] hover:text-white cursor-pointer select-none border-l border-[#2a2a3e] pl-2 ml-1">
                      <input
                        type="checkbox"
                        checked={showEdgeLabels}
                        onChange={(e) => setShowEdgeLabels(e.target.checked)}
                        className="rounded border-[#2a2a3e] bg-[#0a0a0f] text-[#ff79c6] focus:ring-[#ff79c6] w-3 h-3 cursor-pointer"
                      />
                      Labels
                    </label>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 bg-[#12121a]/85 border border-[#2a2a3e] rounded-xl px-3 py-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-[#888898] hover:text-white cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showRelationshipFlow}
                        onChange={(e) => setShowRelationshipFlow(e.target.checked)}
                        className="rounded border-[#2a2a3e] bg-[#0a0a0f] text-[#ff79c6] focus:ring-[#ff79c6] w-3.5 h-3.5 cursor-pointer"
                      />
                      Show Relationship Flow
                    </label>
                  </div>
                )}

                {/* Save/Reset Layout actions */}
                {isLayoutDirty && viewMode === 'flow' && (
                  <div className="flex items-center gap-1.5 bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-xl p-1">
                    <button
                      onClick={handleSaveLayout}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5" /> Save Layout
                    </button>
                    <button
                      onClick={handleResetLayout}
                      disabled={submitting}
                      className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                      title="Reset changes"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Graph Visualization Container */}
          <div className="flex-1 relative bg-[#050508] overflow-hidden">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Spinner size="lg" />
                  <p className="mt-4 text-sm text-[#6b6b7b]">Loading graph...</p>
                </div>
              </div>
            ) : error ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-sm">
                  <ZapOff className="w-12 h-12 text-[#ef4444] mx-auto mb-3" />
                  <p className="text-sm text-[#ef4444] mb-3">{error}</p>
                  <Button variant="secondary" size="sm" onClick={fetchData}>Retry</Button>
                </div>
              </div>
            ) : viewMode === 'flow' ? (
              <div className="w-full h-full relative">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDragStop={onNodeDragStop}
                  onConnect={onConnect}
                  onNodeClick={onNodeClick}
                  onPaneClick={onPaneClick}
                  nodeTypes={nodeTypes}
                  fitView
                  minZoom={isMobile ? 0.05 : 0.5}
                  maxZoom={isMobile ? 1.5 : 2}
                  onlyRenderVisibleElements={true}
                  className="bg-[#0a0a0f]"
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="#1f1f2e" gap={28} size={1} />
                </ReactFlow>

                {/* Custom Glassmorphic Zoom Controls */}
                <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl">
                  <button
                    onClick={() => zoomIn({ duration: 300 })}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => zoomOut({ duration: 300 })}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fitView({ duration: 400 })}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Fit View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : viewMode === 'network' ? (
              <div className="w-full h-full relative">
                {(() => {
                  const selectedEntityIdStr = selectedEntity ? selectedEntity.id.toString() : null;
                  const hoveredNodeIdStr = hoveredNode ? hoveredNode.id : null;
                  const isHighlighting = highlightedNodes.size > 0;
                  const isFocusActive = hoveredNode || selectedEntity;

                  return (
                    <ForceGraph2D
                      ref={fgRef}
                      graphData={networkGraphData}
                      backgroundColor="#050508"
                      cooldownTicks={isMobile ? 10 : undefined}
                      d3AlphaDecay={isMobile ? 0.1 : 0.0228}
                      nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                        const label = node.name;
                        const color = getEntityColor(node.type || 'Plant');
                        const nodeIdStr = String(node.id);
                        
                        const isSelected = selectedEntity && (
                          selectedEntity.isCluster
                            ? (node.isCluster && node.type === selectedEntity.clusterType)
                            : (nodeIdStr === selectedEntityIdStr)
                        );
                        const isHovered = hoveredNodeIdStr && (nodeIdStr === hoveredNodeIdStr);
                        
                        const isHighlighted = !isHighlighting || 
                          highlightedNodes.has(nodeIdStr) || 
                          (node.isCluster && node.type === selectedEntity?.type);
                    
                    const opacity = isHighlighted ? 1 : 0.15;
                    
                    ctx.save();
                    ctx.globalAlpha = opacity;
                    
                    // Node Circle Paint - glowing radial gradient circle
                    const baseRadius = node.isCluster ? 14 : 9;
                    const radius = isSelected || isHovered ? baseRadius * 1.5 : baseRadius;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
                    
                    ctx.fillStyle = color;
                    if (!isMobile) {
                      ctx.shadowColor = color;
                      ctx.shadowBlur = (isSelected || isHovered) ? 20 : 8;
                    }
                    ctx.fill();
                    
                    if (!isMobile || isSelected || isHovered) {
                      if (node.isCluster) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                      } else if (isSelected || isHovered) {
                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                      } else {
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                        ctx.lineWidth = 1;
                        ctx.stroke();
                      }
                    }
                    
                    // Progressive disclosure of labels to avoid clumping
                    const isNeighbor = highlightedNodes.has(nodeIdStr);
                    
                    // On mobile, show fewer labels to save performance
                    const zoomThreshold = isMobile ? 2.5 : 0.4;
                    const limitScale = isMobile ? false : entities.length < 100;
                    const showLabel = node.isCluster || isSelected || isHovered || (isFocusActive && isNeighbor) || globalScale > zoomThreshold || limitScale;
                    
                    if (showLabel) {
                      const fontSize = Math.min(14, Math.max(9, 11 / globalScale));
                      ctx.font = `500 ${fontSize}px Fira Sans, Sans-Serif`;
                      const textWidth = ctx.measureText(label).width;
                      const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.35);
                      
                      const cardX = node.x - bckgDimensions[0] / 2;
                      const cardY = node.y - radius - bckgDimensions[1] - 4;
                      const cardW = bckgDimensions[0];
                      const cardH = bckgDimensions[1];
                      
                      if (isMobile) {
                        // Simple rectangle background for mobile (faster rendering)
                        ctx.fillStyle = 'rgba(10, 10, 15, 0.88)';
                        ctx.fillRect(cardX, cardY, cardW, cardH);
                        if (isSelected || isHovered) {
                          ctx.strokeStyle = color;
                          ctx.lineWidth = 1;
                          ctx.strokeRect(cardX, cardY, cardW, cardH);
                        }
                      } else {
                        // Rounded card background with curves for desktop
                        const r = 4;
                        ctx.fillStyle = 'rgba(10, 10, 15, 0.88)';
                        ctx.beginPath();
                        ctx.moveTo(cardX + r, cardY);
                        ctx.lineTo(cardX + cardW - r, cardY);
                        ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
                        ctx.lineTo(cardX + cardW, cardY + cardH - r);
                        ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
                        ctx.lineTo(cardX + r, cardY + cardH);
                        ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
                        ctx.lineTo(cardX, cardY + r);
                        ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
                        ctx.closePath();
                        ctx.fill();
                        
                        // Card border (glowing if selected/hovered)
                        ctx.strokeStyle = isSelected || isHovered ? color : 'rgba(255, 255, 255, 0.1)';
                        ctx.lineWidth = isSelected || isHovered ? 1.2 : 0.8;
                        ctx.stroke();
                      }

                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillStyle = isSelected || isHovered ? '#ffffff' : '#b0b0c0';
                      ctx.fillText(label, node.x, node.y - radius - bckgDimensions[1] / 2 - 4);
                    }
                    
                    ctx.restore();
                  }}
                  linkCanvasObjectMode={() => 'after'}
                  linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                    const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                    
                    const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                    const isHighlighted = !isHighlighting || highlightedEdges.has(link.id);
                    
                    // Progressive disclosure for link labels
                    // On mobile, hide link labels completely to save performance unless hovered/selected
                    const showLinkLabel = (isMobile ? isSelectedOrHovered : (showEdgeLabels || isSelectedOrHovered || (isHighlighted && (hoveredNode || selectedEntity)) || globalScale > 1.1));
                    if (!showLinkLabel) return;

                    const opacity = isHighlighted ? 1 : 0.12;

                    ctx.save();
                    ctx.globalAlpha = opacity;

                    const start = link.source;
                    const end = link.target;
                    if (typeof start === 'object' && typeof end === 'object') {
                      const textX = start.x + (end.x - start.x) / 2;
                      const textY = start.y + (end.y - start.y) / 2;
                      
                      const fontSize = Math.min(10, Math.max(6, 8 / globalScale));
                      ctx.font = `500 ${fontSize}px Fira Sans, Sans-Serif`;
                      
                      // Label backing box
                      const labelText = link.label || '';
                      const textWidth = ctx.measureText(labelText).width;
                      ctx.fillStyle = 'rgba(5, 5, 8, 0.75)';
                      ctx.fillRect(textX - textWidth / 2 - 2, textY - fontSize / 2 - 2, textWidth + 4, fontSize + 4);
                      
                      ctx.fillStyle = isSelectedOrHovered ? '#ffffff' : '#888898';
                      ctx.textAlign = 'center';
                      ctx.textBaseline = 'middle';
                      ctx.fillText(labelText, textX, textY);
                    }
                    ctx.restore();
                  }}
                  linkColor={link => {
                    if (isMobile) return '#2a2a3e'; // Simplified but visible rendering
                    const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                    const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                    const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                    const isHighlighted = !isHighlighting || highlightedEdges.has(link.id);
                    if (!isHighlighted) return '#101018';
                    return isSelectedOrHovered ? '#ff79c6' : '#33334d';
                  }}
                  linkWidth={link => {
                    if (isMobile) return 1;
                    const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                    const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                    const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                    return isSelectedOrHovered ? 2.5 : 1;
                  }}
                  linkDirectionalParticles={link => {
                    if (!showRelationshipFlow || isMobile) return 0; // Disable particles entirely on mobile
                    const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                    const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                    const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                    return isSelectedOrHovered ? 4 : 2;
                  }}
                  linkDirectionalParticleWidth={2}
                  linkDirectionalParticleSpeed={0.006}
                  linkDirectionalParticleColor={() => '#ff79c6'}
                  onNodeClick={(node: any) => {
                    if (node.isCluster) {
                      setSelectedEntity({
                        isCluster: true,
                        id: node.id,
                        type: node.type,
                        name: node.name,
                        description: `A cluster containing ${node.count} individual nodes of type ${node.type}. Click 'Expand cluster' in the left Entity Types panel to view them individually.`
                      });
                      setDetailPanelOpen(true);
                    } else {
                      const entity = entities.find(e => e.id.toString() === node.id);
                      if (entity) {
                        setSelectedEntity(entity);
                        setDetailPanelOpen(true);
                      }
                    }
                  }}
                  onNodeDragEnd={async (node: any) => {
                    if (node.isCluster) return;
                    const newX = node.x;
                    const newY = node.y;
                    
                    // Update ReactFlow node coordinates state in memory
                    setNodes(prev => prev.map(n => n.id === node.id ? { ...n, position: { x: newX, y: newY } } : n));
                    
                    // Save the new position to database immediately
                    const entity = entities.find(e => e.id.toString() === node.id);
                    if (entity) {
                      const newProperties = { ...entity.properties, ui_x: newX, ui_y: newY };
                      try {
                        await entityApi.update(entity.id, {
                          name: entity.name,
                          type: entity.type,
                          description: entity.description,
                          properties: newProperties,
                        });
                        setEntities(prev => prev.map(e => e.id === entity.id ? { ...e, properties: newProperties } : e));
                      } catch (err) {
                        console.error('Failed to save force node position:', err);
                      }
                    }
                  }}
                  onNodeHover={node => {
                    document.body.style.cursor = node ? 'pointer' : 'default';
                    setHoveredNode(node);
                  }}
                />
                  );
                })()}

                {/* Custom Glassmorphic Zoom Controls for Network View */}
                <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl">
                  <button
                    onClick={() => {
                      if (fgRef.current) {
                        const zoom = fgRef.current.zoom();
                        fgRef.current.zoom(zoom * 1.3, 300);
                      }
                    }}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (fgRef.current) {
                        const zoom = fgRef.current.zoom();
                        fgRef.current.zoom(zoom / 1.3, 300);
                      }
                    }}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (fgRef.current) {
                        fgRef.current.zoomToFit(400, 50);
                      }
                    }}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Fit View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Floating Glassmorphic Legend & Instructions */}
                <div className="hidden md:flex absolute bottom-4 right-4 z-10 max-w-[280px] bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl flex-col gap-2 pointer-events-auto">
                  <div className="flex items-center gap-1.5 border-b border-[#2a2a3e] pb-1.5 mb-1">
                    <Compass className="w-3.5 h-3.5 text-[#ff79c6]" />
                    <span className="text-xs font-bold text-white">Network Explorer</span>
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                    {allTypes.map(type => {
                      const color = getEntityColor(type);
                      const count = entities.filter(e => e.type === type).length;
                      return (
                        <div key={type} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[#a0a0b0]">{type}</span>
                          </div>
                          <span className="text-[#6b6b7b] tabular-nums">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#2a2a3e] pt-1.5 mt-1 text-[10px] text-[#6b6b7b] leading-normal space-y-1">
                    <p>• Scroll to zoom. Drag canvas to pan.</p>
                    <p>• Hover over nodes to focus connections.</p>
                    <p>• Click any node to open details.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {(() => {
                  const selectedEntityIdStr = selectedEntity ? selectedEntity.id.toString() : null;
                  const hoveredNodeIdStr = hoveredNode ? hoveredNode.id : null;
                  const isHighlighting = highlightedNodes.size > 0;

                  return (
                    <ForceGraph3D
                      ref={fgRef}
                      graphData={networkGraphData}
                      backgroundColor="#050508"
                      cooldownTicks={120}
                      d3VelocityDecay={0.45}
                      linkResolution={6}
                      nodeThreeObject={(node: any) => {
                        const group = new THREE.Group();
                        
                        // 1. Draw glowing metallic/glass energy sphere representing the node
                        const color = getEntityColor(node.type || 'Plant');
                        const nodeIdStr = String(node.id);
                        
                        const isSelected = selectedEntity && (
                          selectedEntity.isCluster
                            ? (node.isCluster && node.type === selectedEntity.clusterType)
                            : (nodeIdStr === selectedEntityIdStr)
                        );
                        const isHovered = hoveredNodeIdStr && (nodeIdStr === hoveredNodeIdStr);
                        const isHighlighted = !isHighlighting || highlightedNodes.has(nodeIdStr);
                        
                        const baseRadius = node.isCluster ? 10 : 5;
                        const radius = isSelected || isHovered ? baseRadius * 1.4 : baseRadius;
                        
                        // Performance optimization: reuse sphere geometry and cached materials
                        const sphereMat = getStandardMaterial(color, isHighlighted);
                        const sphere = new THREE.Mesh(cachedSphereGeo, sphereMat);
                        sphere.scale.setScalar(radius);
                        group.add(sphere);

                        // 2. Draw text label if node is highlighted/selected/hovered or when no filters are active
                        // This prevents heavy text overlap clutter
                        const isNeighbor = highlightedNodes.has(nodeIdStr);
                        const showLabel = isSelected || isHovered || isNeighbor || !isHighlighting;
                        
                        if (showLabel) {
                          const canvas = document.createElement('canvas');
                          const ctx = canvas.getContext('2d');
                          if (ctx) {
                            canvas.width = 240;
                            canvas.height = 54;
                            
                            // Text background box
                            ctx.fillStyle = 'rgba(10, 10, 15, 0.7)';
                            ctx.strokeStyle = isSelected || isHovered ? color : 'rgba(255, 255, 255, 0.1)';
                            ctx.lineWidth = 1.5;
                            
                            // Simple rounded rectangle path compatibility
                            const x = 2;
                            const y = 2;
                            const w = canvas.width - 4;
                            const h = canvas.height - 4;
                            const r = 6;
                            ctx.beginPath();
                            ctx.moveTo(x + r, y);
                            ctx.lineTo(x + w - r, y);
                            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
                            ctx.lineTo(x + w, y + h - r);
                            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
                            ctx.lineTo(x + r, y + h);
                            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
                            ctx.lineTo(x, y + r);
                            ctx.quadraticCurveTo(x, y, x + r, y);
                            ctx.closePath();
                            ctx.fill();
                            ctx.stroke();
                            
                            // Text label
                            ctx.font = 'bold 15px sans-serif';
                            ctx.fillStyle = '#ffffff';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            
                            // Truncate text if too long
                            let text = node.name;
                            if (text.length > 20) text = text.substring(0, 18) + '...';
                            ctx.fillText(text, canvas.width / 2, canvas.height / 2);
                            
                            const texture = new THREE.CanvasTexture(canvas);
                            const spriteMat = new THREE.SpriteMaterial({
                              map: texture,
                              transparent: true,
                              depthWrite: false,
                              opacity: isHighlighted ? 0.95 : 0.3
                            });
                            const sprite = new THREE.Sprite(spriteMat);
                            
                            // Place sprite text label above the sphere
                            sprite.position.set(0, radius + 7, 0);
                            sprite.scale.set(24, 5.4, 1);
                            group.add(sprite);
                          }
                        }
                        
                        return group;
                      }}
                      nodeLabel={(node: any) => `${node.name} (${node.type})`}
                      nodeRelSize={6}
                      linkColor={(link: any) => {
                        const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                        const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                        const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                        const isHighlighted = !isHighlighting || highlightedEdges.has(link.id);
                        if (!isHighlighted) return '#101018';
                        return isSelectedOrHovered ? '#ff79c6' : '#33334d';
                      }}
                      linkWidth={(link: any) => {
                        const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                        const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                        const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                        return isSelectedOrHovered ? 2.5 : 0.8;
                      }}
                      linkDirectionalParticles={(link: any) => {
                        if (!showRelationshipFlow) return 0;
                        const sourceId = String(typeof link.source === 'object' ? link.source.id : link.source);
                        const targetId = String(typeof link.target === 'object' ? link.target.id : link.target);
                        const isSelectedOrHovered = (selectedEntityIdStr && (sourceId === selectedEntityIdStr || targetId === selectedEntityIdStr)) || (hoveredNodeIdStr && (sourceId === hoveredNodeIdStr || targetId === hoveredNodeIdStr));
                        return isSelectedOrHovered ? 4 : 2;
                      }}
                      linkDirectionalParticleWidth={2}
                      linkDirectionalParticleSpeed={0.006}
                      linkDirectionalParticleColor={() => '#ff79c6'}
                      onNodeClick={(node: any) => {
                        if (node.isCluster) {
                          setSelectedEntity({
                            isCluster: true,
                            id: node.id,
                            type: node.type,
                            name: node.name,
                            description: `A cluster containing ${node.count} individual nodes of type ${node.type}.`
                          });
                          setDetailPanelOpen(true);
                        } else {
                          const entity = entities.find(e => e.id.toString() === node.id);
                          if (entity) {
                            setSelectedEntity(entity);
                            setDetailPanelOpen(true);
                          }
                        }
                      }}
                      onNodeHover={(node: any) => {
                        document.body.style.cursor = node ? 'pointer' : 'default';
                        setHoveredNode(node);
                      }}
                    />
                  );
                })()}

                {/* Custom Glassmorphic Zoom Controls for Network 3D View */}
                <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-1 bg-[#0a0a0f]/80 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-2xl">
                  <button
                    onClick={() => {
                      if (fgRef.current) {
                        const camera = fgRef.current.camera();
                        if (camera) {
                          gsap.to(camera.position, {
                            x: camera.position.x * 0.8,
                            y: camera.position.y * 0.8,
                            z: camera.position.z * 0.8,
                            duration: 0.3
                          });
                        }
                      }
                    }}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom In"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (fgRef.current) {
                        const camera = fgRef.current.camera();
                        if (camera) {
                          gsap.to(camera.position, {
                            x: camera.position.x * 1.2,
                            y: camera.position.y * 1.2,
                            z: camera.position.z * 1.2,
                            duration: 0.3
                          });
                        }
                      }
                    }}
                    className="p-2 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Zoom Out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

          {/* Floating stats pill & Mobile Toggle */}
          {!loading && !error && (
            <div className="absolute top-4 left-4 z-20 flex flex-col sm:flex-row gap-2 pointer-events-auto">
              <button 
                className="md:hidden bg-accent hover:bg-accent-hover rounded-full px-4 py-2 flex items-center gap-2 text-xs font-semibold text-white shadow-lg shadow-accent/20 border border-accent/30 transition-colors"
                onClick={() => setMobileFiltersOpen(true)}
              >
                <Filter className="w-4 h-4 text-white" />
                Open Sidebar
              </button>
              
              <div className="glass rounded-full px-5 py-2 flex items-center gap-4 shadow-lg border border-white/10">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#ff79c6]" />
                  <span className="text-xs text-[#a0a0b0]">{nodes.length} nodes</span>
                </div>
                <div className="w-px h-3 bg-[#2a2a3e]" />
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#d68eff]" />
                  <span className="text-xs text-[#a0a0b0]">{edges.length} edges</span>
                </div>
              </div>
            </div>
          )}
          </div>


        </div>

        {/* ── Right Detail Panel ──────────────────────────── */}
        {detailPanelOpen && selectedEntity && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setDetailPanelOpen(false)} />
        )}
        <div
          className={cn(
            'absolute right-0 top-0 bottom-0 w-[340px] max-w-full bg-[#0a0a0f]/95 backdrop-blur-md border-l border-[#2a2a3e] transition-spring z-50 flex flex-col',
            detailPanelOpen && selectedEntity ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          {selectedEntity && (
            <>
              {/* Panel header */}
              <div className="p-4 border-b border-[#2a2a3e] flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <Badge variant="entity" entityType={selectedEntity.type}>{selectedEntity.type}</Badge>
                  <h3 className="text-lg font-semibold text-white mt-2 truncate">{selectedEntity.name}</h3>
                </div>
                <button
                  onClick={() => { setDetailPanelOpen(false); setSelectedEntity(null); }}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#6b6b7b] hover:text-white transition-colors ml-2"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* 3D Model Viewer */}
                {(selectedEntity.properties?.model_url || selectedEntity.properties?.model || ['Device', 'Server', 'Asset', 'Infrastructure', 'Host', 'Equipment', 'Database', 'System', 'NetworkNode', 'Component'].includes(selectedEntity.type)) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-[#6b6b7b] uppercase tracking-wider">3D Asset Twin</h4>
                    <ModelViewer
                      url={selectedEntity.properties?.model_url || selectedEntity.properties?.model || "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/DamagedHelmet/glTF-Binary/DamagedHelmet.glb"}
                      height={180}
                      autoRotate={true}
                    />
                  </div>
                )}

                {/* Description */}
                {selectedEntity.description && (
                  <div>
                    <h4 className="text-xs font-medium text-[#6b6b7b] uppercase tracking-wider mb-2">Description</h4>
                    <p className="text-sm text-[#a0a0b0] leading-relaxed">{selectedEntity.description}</p>
                  </div>
                )}

                {/* Properties */}
                {selectedEntity.properties && Object.keys(selectedEntity.properties).length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-[#6b6b7b] uppercase tracking-wider mb-2">Properties</h4>
                    <div className="space-y-1.5">
                      {Object.entries(selectedEntity.properties).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#12121a] border border-[#2a2a3e]">
                          <span className="text-xs text-[#6b6b7b]">{key}</span>
                          <span className="text-xs text-white font-medium">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connections */}
                <div>
                  <h4 className="text-xs font-medium text-[#6b6b7b] uppercase tracking-wider mb-2">
                    Connections ({selectedConnections.length})
                  </h4>
                  {selectedConnections.length === 0 ? (
                    <p className="text-xs text-[#6b6b7b] italic">No connections</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedConnections.map((rel) => {
                        const isSource = rel.source_id === selectedEntity.id;
                        const otherName = isSource ? rel.target_name : rel.source_name;
                        return (
                          <div key={rel.id} className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[#12121a] border border-[#2a2a3e] hover:border-[#3a3a4e] transition-colors">
                            <ChevronRight className={cn('w-3 h-3 text-[#ff79c6]', !isSource && 'rotate-180')} />
                            <span className="text-xs text-[#ff79c6] font-medium">{rel.type.replace(/_/g, ' ')}</span>
                            <span className="text-xs text-[#a0a0b0] truncate flex-1">{otherName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Panel actions */}
              <div className="p-4 border-t border-[#2a2a3e] flex flex-col gap-2">
                <Button 
                  variant="primary" 
                  size="sm" 
                  className="w-full justify-center" 
                  onClick={() => router.push(`/entities/${selectedEntity.id}`)}
                >
                  View Full Profile
                </Button>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" className="flex-1 justify-center" icon={<Edit3 className="w-3.5 h-3.5" />} onClick={openEditModal}>
                    Edit
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1 justify-center" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleDeleteEntity}>
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Add Entity Modal ────────────────────────────── */}
        <Modal isOpen={addEntityOpen} onClose={() => setAddEntityOpen(false)} title="Add New Entity">
          <div className="space-y-4">
            <Input
              label="Entity Name"
              placeholder="e.g., Rice, Malaria, Nitrogen..."
              value={entityForm.name}
              onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="Entity Type"
              value={entityForm.type}
              onChange={(e) => setEntityForm((f) => ({ ...f, type: e.target.value as EntityType }))}
              options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#a0a0b0]">Description</label>
              <textarea
                rows={3}
                placeholder="Describe this entity..."
                value={entityForm.description}
                onChange={(e) => setEntityForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/50 hover:border-[#3a3a4e] transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setAddEntityOpen(false)} className="flex-1">Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddEntity}
                loading={submitting}
                disabled={!entityForm.name.trim()}
                className="flex-1"
              >
                Create Entity
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── Edit Entity Modal ───────────────────────────── */}
        <Modal isOpen={editEntityOpen} onClose={() => setEditEntityOpen(false)} title="Edit Entity">
          <div className="space-y-4">
            <Input
              label="Entity Name"
              value={entityForm.name}
              onChange={(e) => setEntityForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label="Entity Type"
              value={entityForm.type}
              onChange={(e) => setEntityForm((f) => ({ ...f, type: e.target.value as EntityType }))}
              options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#a0a0b0]">Description</label>
              <textarea
                rows={3}
                value={entityForm.description}
                onChange={(e) => setEntityForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/50 hover:border-[#3a3a4e] transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditEntityOpen(false)} className="flex-1">Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleEditEntity}
                loading={submitting}
                disabled={!entityForm.name.trim()}
                className="flex-1"
              >
                Save Changes
              </Button>
            </div>
          </div>
        </Modal>

        {/* ── Add Relationship Modal ──────────────────────── */}
        <Modal isOpen={addRelOpen} onClose={() => setAddRelOpen(false)} title="Add Relationship">
          <div className="space-y-4">
            <SearchableEntitySelect
              label="Source Entity"
              value={relForm.source_id}
              onChange={(val) => setRelForm((f) => ({ ...f, source_id: val }))}
              entities={entities}
            />
            <Select
              label="Relationship Type"
              value={relForm.type}
              onChange={(e) => setRelForm((f) => ({ ...f, type: e.target.value }))}
              options={RELATIONSHIP_TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') }))}
            />
            <SearchableEntitySelect
              label="Target Entity"
              value={relForm.target_id}
              onChange={(val) => setRelForm((f) => ({ ...f, target_id: val }))}
              entities={entities}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[#a0a0b0]">Description (optional)</label>
              <textarea
                rows={2}
                placeholder="Describe this relationship..."
                value={relForm.description}
                onChange={(e) => setRelForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full bg-[#12121a] border border-[#2a2a3e] rounded-lg px-4 py-2.5 text-white placeholder-[#6b6b7b] focus:outline-none focus:border-[#ff79c6] focus:ring-1 focus:ring-[#ff79c6]/50 hover:border-[#3a3a4e] transition-colors resize-none"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setAddRelOpen(false)} className="flex-1">Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddRelationship}
                loading={submitting}
                disabled={!relForm.source_id || !relForm.target_id}
                className="flex-1"
              >
                Create Relationship
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </AppShell>
  );
}