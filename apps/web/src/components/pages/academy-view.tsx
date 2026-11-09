"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Eye, GraduationCap, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

import { createStudyCard, deleteStudyCard, getStudyCards, reviewStudyCard } from "@/lib/api";
import type { StudyCard } from "@/lib/types";
import { formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const inputClass = "h-9 w-full rounded-lg border border-border bg-surface-inset px-2.5 text-[11px] text-foreground outline-none placeholder:text-foreground-muted focus:border-primary/50";

export function AcademyView() {
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [decks, setDecks] = useState<Record<string, number>>({});
  const [deck, setDeck] = useState<string>("all");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [newDeck, setNewDeck] = useState("General");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getStudyCards();
      setCards(data.cards);
      setDecks(data.decks);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load flashcards.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => (deck === "all" ? cards : cards.filter((card) => card.deck === deck)), [cards, deck]);
  const current = visible.length ? visible[index % visible.length] : null;

  async function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!front.trim() || !back.trim()) {
      setError("Front and back are required.");
      return;
    }
    setError(null);
    try {
      await createStudyCard({ deck: newDeck.trim() || "General", front: front.trim(), back: back.trim() });
      setFront("");
      setBack("");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add card.");
    }
  }

  async function markReviewed(card: StudyCard) {
    try {
      await reviewStudyCard(card.id);
      setRevealed(null);
      setIndex((value) => value + 1);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record review.");
    }
  }

  async function remove(card: StudyCard) {
    try {
      await deleteStudyCard(card.id);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete card.");
    }
  }

  return (
    <div className="space-y-5 pb-8 pt-6 sm:pt-8">
      <header className="rounded-[24px] border border-border bg-surface p-5 sm:p-6">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary-hover">
          <GraduationCap className="h-3.5 w-3.5" /> Academy
        </span>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-[-0.02em] text-foreground sm:text-[34px]">Flashcards</h1>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-foreground-secondary">
          Write your own cards and review them. Review counts increase only when you mark a card reviewed. Study plans and document-based quizzes come after document ingestion.
        </p>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-error/25 bg-error/[0.05] px-3 py-2.5 text-[11px] text-error/90">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="New card" icon={<Plus className="h-3.5 w-3.5" />} />
          <CardContent>
            <form onSubmit={add} className="space-y-3">
              <input value={newDeck} onChange={(e) => setNewDeck(e.target.value)} placeholder="Deck" maxLength={80} className={inputClass} />
              <textarea value={front} onChange={(e) => setFront(e.target.value)} placeholder="Front (question)" rows={2} maxLength={2000} className={`${inputClass} h-auto py-2`} />
              <textarea value={back} onChange={(e) => setBack(e.target.value)} placeholder="Back (answer)" rows={3} maxLength={4000} className={`${inputClass} h-auto py-2`} />
              <div className="flex justify-end">
                <Button variant="primary" type="submit"><Plus className="h-3.5 w-3.5" /> Add card</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Review"
            description={`${visible.length} card${visible.length === 1 ? "" : "s"}`}
            icon={<GraduationCap className="h-3.5 w-3.5" />}
            actions={<Button variant="secondary" size="sm" onClick={() => { void load(); }} aria-label="Refresh cards"><RefreshCw className="h-3.5 w-3.5" /></Button>}
          />
          <CardContent className="space-y-3">
            <select value={deck} onChange={(e) => { setIndex(0); setRevealed(null); setDeck(e.target.value); }} className={inputClass} aria-label="Deck">
              <option value="all">All decks ({cards.length})</option>
              {Object.entries(decks).map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
            </select>
            {loading ? (
              <div className="flex items-center gap-2 text-[12px] text-foreground-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
            ) : !current ? (
              <p className="py-8 text-center text-[12px] text-foreground-secondary">No cards yet. Add one to start reviewing.</p>
            ) : (
              <div className="space-y-3 rounded-xl border border-border bg-surface-inset/50 p-4">
                <p className="text-[10px] text-foreground-muted">{current.deck} · reviewed {current.review_count} time{current.review_count === 1 ? "" : "s"}{current.last_reviewed_at ? ` · last ${formatRelative(current.last_reviewed_at)}` : ""}</p>
                <p className="text-[14px] font-semibold text-foreground">{current.front}</p>
                {revealed === current.id ? (
                  <p className="whitespace-pre-wrap text-[12px] text-foreground-secondary">{current.back}</p>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setRevealed(current.id)}><Eye className="h-3.5 w-3.5" /> Show answer</Button>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => { void remove(current); }}><Trash2 className="h-3.5 w-3.5" /> Delete</Button>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setRevealed(null); setIndex((value) => value + 1); }}>Skip</Button>
                    <Button variant="primary" size="sm" onClick={() => { void markReviewed(current); }} disabled={revealed !== current.id}>Mark reviewed</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
