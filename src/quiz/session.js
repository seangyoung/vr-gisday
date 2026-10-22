export const ROUND_SECONDS = 18;
export const PROMPT_SECONDS = 3.4;

export function validateQuestion(question) {
  if (!question || typeof question.id !== "string" || !question.id.trim())
    throw new TypeError("A question needs an ID");
  if (typeof question.prompt !== "string" || !question.prompt.trim())
    throw new TypeError(`Question ${question.id} needs a prompt`);
  if (!Array.isArray(question.choices) || question.choices.length < 3 ||
      question.choices.length > 4 ||
      question.choices.some((choice) => typeof choice !== "string" || !choice.trim()) ||
      new Set(question.choices.map((choice) => choice.trim().toLowerCase())).size !==
        question.choices.length)
    throw new TypeError(`Question ${question.id} needs 3–4 distinct choices`);
  if (!Number.isInteger(question.correct) || question.correct < 0 ||
      question.correct >= question.choices.length)
    throw new TypeError(`Question ${question.id} needs one valid correct choice`);
  if (typeof question.explanation !== "string" || !question.explanation.trim())
    throw new TypeError(`Question ${question.id} needs an explanation`);
  if (question.approved !== true)
    throw new TypeError(`Question ${question.id} has not been approved`);
  return question;
}

export class QuizSession {
  constructor(questions, initials, options = {}) {
    if (!/^[A-Z]{3}$/.test(initials))
      throw new TypeError("Initials must be three letters");
    if (!Array.isArray(questions) || !questions.length)
      throw new TypeError("A quiz needs approved questions");
    this.questions = questions.map(validateQuestion);
    if (new Set(this.questions.map((question) => question.id)).size !==
        this.questions.length)
      throw new TypeError("Question IDs must be unique");
    this.initials = initials;
    this.roundSeconds = options.roundSeconds ?? ROUND_SECONDS;
    this.promptSeconds = options.promptSeconds ?? PROMPT_SECONDS;
    if (!Number.isFinite(this.roundSeconds) || !(this.roundSeconds > 0) ||
        !Number.isFinite(this.promptSeconds) || !(this.promptSeconds >= 0))
      throw new RangeError("Quiz durations must be finite and nonnegative");
    this.phase = "ready";
    this.index = 0;
    this.remaining = this.roundSeconds;
    this.promptRemaining = this.promptSeconds;
    this.pausedFrom = null;
    this.score = 0;
    this.correctCount = 0;
    this.results = [];
  }

  get question() {
    return this.questions[this.index] ?? null;
  }

  get complete() {
    return this.phase === "complete";
  }

  start() {
    if (this.phase !== "ready") return false;
    this.phase = this.promptSeconds ? "prompt" : "question";
    return true;
  }

  pause(reason) {
    if ((this.phase !== "prompt" && this.phase !== "question" &&
         this.phase !== "feedback") ||
        (reason !== "audio" && reason !== "quit")) return false;
    this.pausedFrom = this.phase;
    this.phase = reason === "audio" ? "audio-paused" : "quit-paused";
    return true;
  }

  resume() {
    if (!this.pausedFrom) return false;
    this.phase = this.pausedFrom;
    this.pausedFrom = null;
    return true;
  }

  quit() {
    if (this.phase !== "quit-paused") return false;
    this.phase = "abandoned";
    this.pausedFrom = null;
    this.score = 0;
    this.results = [];
    return true;
  }

  answer(choice) {
    if (this.phase !== "question" || !Number.isInteger(choice) ||
        choice < 0 || choice >= this.question.choices.length) return null;
    return this.resolve(choice);
  }

  resolve(choice) {
    const correct = choice === this.question.correct;
    const gained = correct ? 100 + Math.floor(100 * this.remaining / this.roundSeconds) : 0;
    this.score += gained;
    if (correct) this.correctCount++;
    const result = {
      questionId: this.question.id,
      choice,
      answerText: choice === null ? null : this.question.choices[choice],
      remaining: this.remaining,
      correct,
      gained,
      explanation: this.question.explanation,
    };
    this.results.push(result);
    this.phase = "feedback";
    return result;
  }

  advance() {
    if (this.phase !== "feedback") return false;
    this.index++;
    if (this.index === this.questions.length) this.phase = "complete";
    else {
      this.remaining = this.roundSeconds;
      this.promptRemaining = this.promptSeconds;
      this.phase = this.promptSeconds ? "prompt" : "question";
    }
    return true;
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError("Invalid elapsed time");
    if (this.phase === "prompt") {
      this.promptRemaining = Math.max(0, this.promptRemaining - dt);
      if (this.promptRemaining === 0) this.phase = "question";
    } else if (this.phase === "question") {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) this.resolve(null);
    }
  }

  finalScore() {
    return this.complete ? {
      initials: this.initials,
      score: this.score,
      correct: this.correctCount,
      total: this.questions.length,
    } : null;
  }
}
