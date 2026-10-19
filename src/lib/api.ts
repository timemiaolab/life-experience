/**
 * Supabase API helpers for fetching graph data and submitting stories
 */
import type { AppData, Contribution, GNode, Link } from '../types';
import { supabase } from './supabase';

export interface FetchGraphResult {
  success: boolean;
  data?: AppData;
  error?: string;
}

interface IdentityFacetRow {
  id: string;
  origin: string | null;
  profession: string | null;
  region: string | null;
  age: string | null;
  city: string | null;
  node_ids: string[] | null;
}

/**
 * Fetch approved graph data from Supabase
 * Returns nodes, links, and vote counts for the approved knowledge graph
 */
export async function fetchApprovedGraph(): Promise<FetchGraphResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Fetch all approved nodes (demo data is still public)
    const { data: nodes, error: nodesError } = await supabase
      .from('nodes')
      .select('*')
      .order('created_at', { ascending: true });

    if (nodesError) {
      return { success: false, error: `Failed to fetch nodes: ${nodesError.message}` };
    }

    // Fetch all links
    const { data: linksData, error: linksError } = await supabase
      .from('links')
      .select('from_id, to_id');

    if (linksError) {
      return { success: false, error: `Failed to fetch links: ${linksError.message}` };
    }

    // Fetch vote counts from public_vote_counts view (anon has access)
    const { data: votesData, error: votesError } = await supabase
      .from('public_vote_counts')
      .select('principle_id, count');

    const votes: Record<string, number> = {};
    if (!votesError && votesData) {
      votesData.forEach((v) => {
        votes[v.principle_id] = v.count;
      });
    }

    // Transform Supabase data to AppData format
    const graphNodes: GNode[] = (nodes || []).map((n) => ({
      id: n.id,
      layer: n.layer,
      title: n.title,
      desc: n.description,
      tag: n.tag,
      keywords: n.keywords || [],
      contributionId: n.contribution_id,
      createdAt: n.created_at,
      demo: n.demo,
      user: n.user_created,
    }));

    const links: Link[] = (linksData || []).map((l) => [l.from_id, l.to_id]);

    // Count distinct contributors (head query for efficiency)
    const { count: contributorCount } = await supabase
      .from('contributors')
      .select('id', { count: 'exact', head: true });

    // Fetch identity facets for filtering (without exposing contributor data)
    // Falls back to empty array if RPC errors/404s
    const { data: facetsData, error: facetsError } = await supabase.rpc('get_identity_facets');
    
    // Transform facets into Contribution objects using real contributor ids
    // so computeView can match scene.contributionId === contribution.id.
    // If the RPC 404s or errors, leave contributions empty (no chips, no crash).
    const contributions: Contribution[] = [];
    if (!facetsError && Array.isArray(facetsData)) {
      for (const facet of facetsData as IdentityFacetRow[]) {
        if (!facet?.id) continue;
        contributions.push({
          id: facet.id,
          identity: {
            origin: facet.origin || '',
            profession: facet.profession || '',
            region: facet.region || '',
            age: facet.age || '',
            city: facet.city || undefined,
          },
          story: '',
          createdAt: '',
          sceneIds: facet.node_ids || [],
        });
      }
    }

    const data: AppData = {
      version: 1,
      nodes: graphNodes,
      links,
      contributions,
      votes,
      myVotes: [],
      contributorCount: contributorCount || 0,
    };

    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export interface SubmitStoryParams {
  identity: {
    origin: string;
    profession: string;
    region: string;
    age: string;
    city?: string;
  };
  story: string;
}

export interface SubmitStoryResult {
  success: boolean;
  submissionId?: string;
  error?: string;
}

/**
 * Submit a new story to Supabase using the submit_story RPC
 * The RPC handles contributor creation and submission atomically
 */
export async function submitStory(params: SubmitStoryParams): Promise<SubmitStoryResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Call the submit_story RPC function
    const { data, error } = await supabase.rpc('submit_story', {
      p_identity: params.identity,
      p_story: params.story,
    });

    if (error) {
      return { success: false, error: `Submission failed: ${error.message}` };
    }

    return { success: true, submissionId: data as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
