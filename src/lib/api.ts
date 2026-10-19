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

    // Fetch contributors (non-demo only for production count)
    const { data: contributorsData } = await supabase
      .from('contributors')
      .select('id, origin, profession, region, age, city, demo, created_at')
      .eq('demo', false);
    
    const contributions: Contribution[] = (contributorsData || []).map((c) => ({
      id: c.id,
      identity: {
        origin: c.origin,
        profession: c.profession,
        region: c.region || '',
        age: c.age,
        city: c.city || undefined,
      },
      story: '', // Story text not fetched in Phase 1
      createdAt: c.created_at,
      sceneIds: [], // Scene mapping not available yet
      engine: 'llm',
      demo: c.demo,
    }));

    const data: AppData = {
      version: 1,
      nodes: graphNodes,
      links,
      contributions,
      votes,
      myVotes: [],
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
