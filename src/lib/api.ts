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

    // Fetch vote counts
    const { data: votesData, error: votesError } = await supabase
      .from('vote_counts')
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

    // We don't fetch full contributions in Phase 1 (they're in submissions table)
    // For now, just return empty contributions array
    const contributions: Contribution[] = [];

    const data: AppData = {
      version: 1,
      nodes: graphNodes,
      links,
      contributions,
      votes,
      myVotes: [], // Will be loaded from localStorage
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
 * Submit a new story to Supabase
 * Creates a contributor record and a submission record
 */
export async function submitStory(params: SubmitStoryParams): Promise<SubmitStoryResult> {
  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const submissionId = `sub_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const contributorId = `c_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    // Insert contributor
    const { error: contributorError } = await supabase
      .from('contributors')
      .insert({
        id: contributorId,
        origin: params.identity.origin,
        profession: params.identity.profession,
        region: params.identity.region,
        age: params.identity.age,
        city: params.identity.city || null,
        demo: false,
      });

    if (contributorError) {
      // If contributor already exists (unlikely with our ID generation), that's OK
      if (contributorError.code !== '23505') {
        return { success: false, error: `Failed to create contributor: ${contributorError.message}` };
      }
    }

    // Insert submission
    const { error: submissionError } = await supabase
      .from('submissions')
      .insert({
        id: submissionId,
        contributor_id: contributorId,
        story: params.story,
        status: 'pending',
      });

    if (submissionError) {
      return { success: false, error: `Failed to create submission: ${submissionError.message}` };
    }

    return { success: true, submissionId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
