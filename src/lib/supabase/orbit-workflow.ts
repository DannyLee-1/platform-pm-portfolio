import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

export type ScenarioCandidateKey = "junyoung" | "seoyeon";
type Client = SupabaseClient<Database>;

export const orbitQuestions = [
  "지역 커뮤니티 서비스의 초기 공급자를 모아 본 경험이 있나요? 없다면 첫 접점을 어떻게 만들까요?",
  "주 10시간 안팎, 8주 안에 첫 작동 버전을 낸다면 어떤 기능부터 줄이시겠어요?",
] as const;

type CandidateResult = {
  scores: readonly [number, number, number];
  why: string;
};

export type RestoredWorkflow = {
  projectId: string | null;
  idea: string;
  selected: ScenarioCandidateKey | null;
  q3: string;
  invitationId: string | null;
  inviteStatus: "sent" | "opened" | "accepted" | "rejected" | null;
  rejectReason: string;
  answers: string[];
  matchId: string | null;
  agreementId: string | null;
  agreementDemand: boolean;
  agreementSupply: boolean;
  agreementContribution: string;
  agreementCompensation: string;
};

export async function loadLatestWorkflow(client: Client, userId: string): Promise<RestoredWorkflow> {
  const empty: RestoredWorkflow = {
    projectId: null,
    idea: "",
    selected: null,
    q3: "",
    invitationId: null,
    inviteStatus: null,
    rejectReason: "",
    answers: [],
    matchId: null,
    agreementId: null,
    agreementDemand: false,
    agreementSupply: false,
    agreementContribution: "주 10시간 내외 · 8주 내 첫 작동 버전",
    agreementCompensation: "지분 15% · 법인 설립 시 재협의",
  };

  const { data: project, error: projectError } = await client
    .from("projects")
    .select("id,idea")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) return empty;

  const restored = { ...empty, projectId: project.id, idea: project.idea };
  const { data: invitation, error: invitationError } = await client
    .from("invitations")
    .select("id,status,q3,reject_reason,scenario_candidate_key")
    .eq("project_id", project.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (invitationError) throw invitationError;
  if (!invitation) return restored;

  restored.invitationId = invitation.id;
  restored.inviteStatus = invitation.status === "expired" ? null : invitation.status;
  restored.rejectReason = invitation.reject_reason ?? "";
  restored.selected = invitation.scenario_candidate_key;

  const [{ data: questions, error: questionsError }, { data: answerRows, error: answersError }, { data: match, error: matchError }, { data: agreement, error: agreementError }] = await Promise.all([
    client.from("matching_questions").select("id,question_no,source,prompt").eq("invitation_id", invitation.id).order("question_no"),
    client.from("matching_answers").select("question_id,answer").eq("invitation_id", invitation.id),
    client.from("matches").select("id").eq("invitation_id", invitation.id).maybeSingle(),
    client.from("agreements").select("id,contribution,compensation,demand_signed_at,supply_signed_at").eq("invitation_id", invitation.id).maybeSingle(),
  ]);
  if (questionsError) throw questionsError;
  if (answersError) throw answersError;
  if (matchError) throw matchError;
  if (agreementError) throw agreementError;

  restored.q3 = questions?.find((question) => question.source === "demand")?.prompt ?? invitation.q3 ?? "";
  const answerByQuestion = new Map(answerRows?.map((answer) => [answer.question_id, answer.answer]) ?? []);
  restored.answers = questions?.map((question) => answerByQuestion.get(question.id) ?? "") ?? [];
  restored.matchId = match?.id ?? null;
  restored.agreementId = agreement?.id ?? null;
  restored.agreementDemand = Boolean(agreement?.demand_signed_at);
  restored.agreementSupply = Boolean(agreement?.supply_signed_at);
  restored.agreementContribution = agreement?.contribution ?? empty.agreementContribution;
  restored.agreementCompensation = agreement?.compensation ?? empty.agreementCompensation;
  return restored;
}

export async function createScenarioInvitation(client: Client, input: {
  projectId: string;
  userId: string;
  candidateKey: ScenarioCandidateKey;
  q3: string;
}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: invitation, error: invitationError } = await client
    .from("invitations")
    .upsert({
      project_id: input.projectId,
      candidate_id: input.userId,
      status: "sent",
      q3: input.q3.trim() || null,
      reject_reason: null,
      expires_at: expiresAt,
      scenario_candidate_key: input.candidateKey,
      scenario_mode: true,
    }, { onConflict: "project_id,candidate_id" })
    .select("id")
    .single();
  if (invitationError) throw invitationError;

  const { error: agreementCleanupError } = await client.from("agreements").delete().eq("invitation_id", invitation.id);
  if (agreementCleanupError) throw agreementCleanupError;
  const { error: matchCleanupError } = await client.from("matches").delete().eq("invitation_id", invitation.id);
  if (matchCleanupError) throw matchCleanupError;
  const { error: deleteError } = await client.from("matching_questions").delete().eq("invitation_id", invitation.id);
  if (deleteError) throw deleteError;
  const prompts = [
    ...orbitQuestions.map((prompt, index) => ({ invitation_id: invitation.id, question_no: index + 1, source: "orbit" as const, prompt })),
    ...(input.q3.trim() ? [{ invitation_id: invitation.id, question_no: 3, source: "demand" as const, prompt: input.q3.trim() }] : []),
  ];
  const { error: questionsError } = await client.from("matching_questions").insert(prompts);
  if (questionsError) throw questionsError;
  const { error: projectError } = await client.from("projects").update({ status: "in_progress" }).eq("id", input.projectId);
  if (projectError) throw projectError;
  return invitation.id;
}

export async function acceptScenarioInvitation(client: Client, input: {
  invitationId: string;
  userId: string;
  answers: string[];
  candidate: CandidateResult;
}) {
  const { data: questions, error: questionsError } = await client
    .from("matching_questions")
    .select("id,question_no")
    .eq("invitation_id", input.invitationId)
    .order("question_no");
  if (questionsError) throw questionsError;
  if (!questions?.length) throw new Error("저장된 매칭 질문을 찾을 수 없습니다.");

  const rows = questions.map((question, index) => ({
    question_id: question.id,
    invitation_id: input.invitationId,
    responder_id: input.userId,
    answer: input.answers[index]?.trim() ?? "",
  }));
  if (rows.some((row) => row.answer.length < 2)) throw new Error("모든 질문에 답변해 주세요.");
  const { error: answersError } = await client.from("matching_answers").upsert(rows, { onConflict: "question_id,responder_id" });
  if (answersError) throw answersError;
  const { error: invitationError } = await client.from("invitations").update({ status: "accepted", reject_reason: null }).eq("id", input.invitationId);
  if (invitationError) throw invitationError;
  const { data: match, error: matchError } = await client.from("matches").upsert({
    invitation_id: input.invitationId,
    role_score: input.candidate.scores[0],
    domain_score: input.candidate.scores[1],
    betting_score: input.candidate.scores[2],
    why_match: input.candidate.why,
  }, { onConflict: "invitation_id" }).select("id").single();
  if (matchError) throw matchError;
  return match.id;
}

export async function rejectScenarioInvitation(client: Client, invitationId: string, reason: string) {
  const { error } = await client.from("invitations").update({ status: "rejected", reject_reason: reason || null }).eq("id", invitationId);
  if (error) throw error;
}

export async function signScenarioAgreement(client: Client, input: {
  projectId: string;
  invitationId: string;
  side: "demand" | "supply";
  contribution: string;
  compensation: string;
  demandSigned: boolean;
  supplySigned: boolean;
}) {
  const now = new Date().toISOString();
  const demandSignedAt = input.side === "demand" || input.demandSigned ? now : null;
  const supplySignedAt = input.side === "supply" || input.supplySigned ? now : null;
  const bothSigned = Boolean(demandSignedAt && supplySignedAt);
  const { data: agreement, error: agreementError } = await client.from("agreements").upsert({
    project_id: input.projectId,
    invitation_id: input.invitationId,
    contribution: input.contribution.trim(),
    compensation: input.compensation.trim(),
    demand_signed_at: demandSignedAt,
    supply_signed_at: supplySignedAt,
    status: bothSigned ? "signed" : "partially-signed",
  }, { onConflict: "invitation_id" }).select("id,demand_signed_at,supply_signed_at").single();
  if (agreementError) throw agreementError;
  if (bothSigned) {
    const { error: projectError } = await client.from("projects").update({ status: "completed" }).eq("id", input.projectId);
    if (projectError) throw projectError;
  }
  return agreement;
}
