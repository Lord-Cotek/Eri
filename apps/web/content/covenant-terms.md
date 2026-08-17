<!-- REVIEW: legal -->
<!--
     This is a plain-English draft written by the build, not legal boilerplate,
     and it has not been reviewed by a lawyer. It describes what the software
     actually does, which is the part worth getting right first. Have counsel
     review it before Ẹ̀rí is offered to anyone outside a test group, and bump
     `termsVersion` in lib/covenant.ts whenever the wording changes — the
     version each man signed is recorded against him and a later revision is
     never applied retroactively.
-->

**Version 2026-08-01**

# The covenant

This is an agreement between two adults. One of you is the **subject** — the
man who installed this on his own devices. One of you is the **ally** — the man
he asked to be told.

Read it before you sign it. It asks something of both of you.

## What the subject agrees to

You are installing this on yourself. Nobody may install it on you, and if
somebody has asked you to sign this under pressure, stop and do not sign.

You agree that a program on your devices will watch for explicit content and
will report that it found some. You agree that when it does, you get a short
window — thirty minutes by default — to tell your ally yourself, and that if
you say nothing, the fact that you said nothing will be reported.

You agree that marking something as a false positive is not a way out. It is
still reported, labelled as contested. There is no button that makes an event
disappear.

You may end this covenant at any time, for any reason, without explaining
yourself. Your ally will be told immediately when you do.

## What the ally agrees to

You are agreeing to be told things. That is most of it, and it is more than it
sounds.

You will be told when an event was disclosed, when a window lapsed, and when a
device stops reporting. You will get one question a week to bring him. You will
never be shown what he saw, because nobody has it — not us, not the server, and
not you.

You agree not to use what you are told to shame him, to hold it over him, or to
tell anyone else. What reaches you is his, and he gave it to you.

You are not his counsellor, not his pastor, and not responsible for his
choices. You are a man who agreed to know, and to stay.

## What the software does

- A program on the subject's devices classifies content **on the device**. The
  image, the page, the video, the text — none of it is ever sent anywhere.
- When it flags something, it sends a coarse category, the time, a confidence
  number and a classifier version. That is the whole message.
- The subject is notified. The ally is not, and will not be, until the window
  closes one way or another.
- If the subject discloses, the ally is told he came forward himself.
- If the window lapses, the ally is told an event was not disclosed.
- If the subject's device stops reporting, the ally is told it went quiet.

## What the software does not do

- It does not take screenshots, and it never sends images.
- It does not record addresses, page text, search terms, or app names.
- It does not block anything. It is a witness, not a wall.
- It does not measure "days clean". It measures days of honest disclosure, and
  that is a different thing on purpose.
- It cannot stop the subject uninstalling it. Nothing can. It can only report
  that his device went quiet.

## What is stored

For each event: a category, when it happened, when it arrived, a confidence
number, a classifier version, which device, what state it ended in, and — if
the subject wrote one — the note he chose to write.

Nothing else. If the database were stolen in full, the worst a reader could
learn is that an event of some category occurred at some time and whether it
was owned.

## Ending it

Either man may walk away.

If the subject ends it, the ally is told at once and the covenant is marked as
ended by the subject. If the ally steps down, the subject is told at once.

Ending a covenant does not delete its history. Events are never deleted.

## What this is not

This is not therapy, not treatment, not pastoral care, and not a substitute for
any of them. If you are in crisis, this software is the wrong tool and it will
say so and point you at a person.

---

By signing you confirm you are over 18, that you are entering this freely, and
that you have read what is written above.
