# Sender & Recipient Experience Improvements

## Overview

Three features to improve how people write and receive feedback in Gently:

1. **Guided Writing Mode** — Help senders write better feedback through structured prompts
2. **Conversational Recipient Experience** — Redesign the receive page around the chat input
3. **Actionable Suggestions** — Help recipients understand what to do with feedback

These are separate features users can choose between, not a single integrated flow.

---

## Feature 1: Guided Writing Mode

### Problem

The current SBI (Situation-Behavior-Impact) detector is reactive — it highlights what's missing after users have already written something. Most people don't know how to write constructive feedback in the first place.

### Solution

An alternative writing mode that asks structured questions in sequence, producing well-formed feedback without requiring users to know the SBI framework.

### How It Works

Instead of a blank textarea, users answer four focused questions (SBI-R framework):

1. **"What happened?"** (Situation)
   - Prompt: "Describe the specific context or event"
   - Example: "During last Tuesday's team standup..."

2. **"What did they do?"** (Behavior)
   - Prompt: "What actions or words did you observe?"
   - Example: "They interrupted two people mid-sentence and dismissed their ideas without discussion..."

3. **"How did it affect things?"** (Impact)
   - Prompt: "What was the result or how did it make you feel?"
   - Example: "The team stopped contributing ideas, and I felt like my input wasn't valued..."

4. **"What would you like them to do differently?"** (Request - optional)
   - Prompt: "Share a specific request for future behavior"
   - Example: "In future standups, I'd appreciate if you could let me finish my thoughts before sharing yours"

Users can navigate back to edit previous answers before submitting. The request step is optional but encouraged.

### Output

The system combines the three answers into a single feedback block, then proceeds through the existing flow: sanitize → preview → share.

### UI Changes

On the Home page, add a toggle above the current textarea:

```
[Write freely] [Guide me]
```

- **Write freely** — Current freeform mode (default)
- **Guide me** — New structured mode

The guided mode replaces the textarea with a step-by-step form. Progress indicator shows which step the user is on.

### Technical Notes

- New component: `GuidedFeedbackForm.jsx`
- State management for multi-step form (current step, answers object)
- Combines answers into single string before calling `/api/feedback/sanitize`
- No backend changes required — output feeds into existing sanitization flow

---

## Feature 2: Conversational Recipient Experience

### Problem

The current Receive page has format buttons (poem, haiku, bullet points, etc.) as the primary interaction, with a chat input as secondary. The format options are novelty-focused and may not be what recipients actually want. There's also no way to ask clarifying questions about the feedback.

### Solution

Redesign the Receive page around the chat as the central interaction point. Remove preset format buttons and guide users through conversation.

### How It Works

When a recipient opens their feedback link:

1. **Welcome message**: "Alex sent you some feedback. How would you like to receive it?"

2. **Suggested prompts** (clickable chips):
   - "Just tell me straight"
   - "Make it gentle"
   - "Give me bullet points"
   - "What can I do about this?"

3. **Chat input**: For freeform requests or questions

After the initial delivery, the conversation continues naturally. Recipients can:
- Ask follow-up questions: "Can you explain the part about communication?"
- Request clarification: "What did they mean by 'meetings'?"
- Ask for different formats: "Now give it to me as a poem"
- Request actionable advice: "What should I do about this?"

### What Claude Has Access To

- Original feedback text (for answering specific questions)
- Sanitized themes
- Sender and recipient names
- Conversation history (already implemented)

No anonymity constraints — the recipient knows who sent the feedback.

### UI Changes

**Remove:**
- Format selection buttons
- Separate sections for different interactions

**Add:**
- Welcome message with sender name
- Suggested prompt chips (replaces format buttons)
- Chat-first layout where the input is prominent

**Keep:**
- Chat input (move to more prominent position)
- Conversation history display
- Markdown rendering for responses

### Technical Notes

- Refactor `Receive.jsx` to chat-centric layout
- Suggested prompts become clickable chips that populate the chat input
- Update system prompt in `/api/feedback/:id/transform` to handle broader query types
- May need new endpoint or expanded transform endpoint for Q&A interactions

---

## Feature 3: Actionable Suggestions

### Problem

Recipients read feedback but don't know what to do with it. Current format options entertain but don't help people improve.

### Solution

When recipients ask "What can I do about this?", Claude generates 2-3 concrete, specific actions based on the feedback themes.

### How It Works

This is a built-in capability of the conversational experience (Feature 2), not a separate UI element.

**Trigger:** User clicks the "What can I do about this?" chip or types a similar question.

**Response:** Claude generates actionable suggestions that are:
- **Specific** — Tied directly to the feedback themes, not generic advice
- **Small** — Achievable actions, not personality overhauls
- **Framed as experiments** — "Try this" not "You must change"

### Example

**Feedback theme:** "Tends to interrupt in meetings"

**Actionable suggestions:**
1. "Try waiting 2 seconds after someone stops talking before responding"
2. "In your next meeting, focus on asking one follow-up question before sharing your view"
3. "Consider taking notes while others speak — it creates a natural pause"

### Follow-up

Recipients can continue the conversation:
- "Give me more ideas"
- "That won't work because I'm remote"
- "Which one should I try first?"

### Technical Notes

- Add to system prompt: instructions for generating actionable suggestions
- Suggestions should reference specific themes from the feedback
- Limit to 2-3 suggestions per response (avoid overwhelming)
- Allow follow-up refinement based on recipient's context

---

## Implementation Order

Recommended sequence:

1. **Feature 2: Conversational Recipient Experience**
   - Foundational change that the other recipient feature builds on
   - Refactors Receive page architecture

2. **Feature 3: Actionable Suggestions**
   - Builds on Feature 2's chat infrastructure
   - Primarily prompt engineering, minimal UI work

3. **Feature 1: Guided Writing Mode**
   - Independent of recipient-side changes
   - Can be developed in parallel if resources allow

---

## Open Questions

1. Should the suggested prompt chips be static or personalized based on feedback content?
2. Should "Guide me" mode be the default for first-time users?
3. Rate limiting considerations for the expanded chat interactions?
