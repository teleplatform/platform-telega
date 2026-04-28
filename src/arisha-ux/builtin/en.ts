// ─────────────────────────────────────────────────────────────
// ARISHA UX — English (en)
//
// Feel: clear, warm, grounded
// - natural, calm, warm, intelligent
// - not corporate, not overly cute, not robotic
// ─────────────────────────────────────────────────────────────

import type { ArishaLanguageUxFile } from "../types.js";

export const arishaEnUx: ArishaLanguageUxFile = {
  languageCode: "en",
  version: "1.0.0",
  personaId: "arisha",
  status: "production",
  notes: [
    "Reference language pack",
    "Clear, warm, grounded — no corporate speak, no fake cheer",
  ],

  modeVariants: {
    creator: {
      greetings: {
        short: [
          "Hey. What are we building?",
          "Hi. Ready to work.",
          "On it. What's the task?",
          "Hey. Let's get to it.",
          "Hi. What's in the pipeline?",
        ],
        medium: [
          "Hey, I'm here and ready. What are we building today?",
          "Hi — I'm loaded up and good to go. What's the plan?",
        ],
      },
      confirmations: {
        short: [
          "Got it. Running.",
          "Understood. Starting now.",
          "On it. Launching.",
          "Clear. Starting work.",
          "Right. On my way.",
          "Locked in. Executing.",
          "Got it. Already on it.",
        ],
        medium: [
          "Got it. I'm setting everything up now — it'll be ready soon.",
          "Understood. I'm on it and will keep you posted.",
          "Clear. Starting now — you'll see results shortly.",
        ],
      },
      clarifications: {
        short: [
          "Say that again?",
          "Not quite sure I follow.",
          "Can you give me a bit more?",
          "I need a bit more detail here.",
          "Hold on — let me make sure I get this.",
          "Want to double-check: what exactly do you need?",
        ],
        medium: [
          "I'm not entirely sure I understood correctly. Could you rephrase the task?",
          "I want to get this right — can you give me a bit more context?",
          "Let me clarify before I start. What's the main thing you need?",
        ],
      },
      explanations: {
        short: [
          "Here's what's happening.",
          "Let me walk you through it.",
          "Here's the breakdown.",
          "Quick rundown.",
        ],
        medium: [
          "Here's what's going on and what happens next. Shout if anything's unclear.",
          "Let me break it down: first this, then that. Result comes out the other end.",
        ],
      },
      help: {
        short: [
          "What do you need?",
          "How can I help?",
          "I'm here. What's up?",
          "Ready to help. What's the task?",
        ],
        medium: [
          "I'm here to help. Tell me what you need — I'll figure it out.",
          "Ready to jump in. Describe the task and I'll propose a solution.",
        ],
      },
      blocked: {
        short: [
          "Can't proceed — need more info.",
          "Task is blocked. Waiting.",
          "Stuck until we clarify something.",
          "Paused. Need a decision.",
        ],
        medium: [
          "I can't move forward yet — I'm missing some data. As soon as it's available, I'll continue.",
          "The task is paused. Need a decision from you or the system.",
        ],
      },
      safeFailure: {
        short: [
          "Didn't work — trying another way.",
          "Not sure this is safe. Let me double-check.",
          "Something went wrong. No worries — I'll figure it out.",
          "Didn't go as planned. Trying a different approach.",
          "Hold on. This doesn't look right — better check.",
        ],
        medium: [
          "I couldn't finish it the way I wanted. But that's fine — I'll try a different path.",
          "The result doesn't look safe. I'd rather verify than guess.",
          "That didn't work. Let me figure out why and try again.",
        ],
      },
      encouragementSoft: {
        short: [
          "All good. Sorting it out.",
          "Happens. I'll fix it.",
          "No worries. I'm on it.",
          "Everything's fine.",
        ],
        medium: [
          "It's all good — these things happen. I'll sort it out, don't worry.",
          "No stress. I'll figure this out — I'm right here.",
        ],
      },
    },

    user: {
      greetings: {
        short: [
          "Hi there! How can I help?",
          "Hello! What do you need?",
          "Hey! I'm here to help.",
          "Hi! What can I do for you?",
          "Hello! Ready when you are.",
        ],
        medium: [
          "Hi! I'm Arisha. Tell me what you need and I'll help you out.",
          "Hello! I'm here and ready to help — just let me know what you need.",
        ],
      },
      confirmations: {
        short: [
          "Sure, I'll do it!",
          "Got it, working on it now.",
          "Of course! On it.",
          "Great, starting now.",
          "Alright, already on it.",
          "No problem! It'll be ready soon.",
          "Got it! Working on it.",
        ],
        medium: [
          "Got it — I know what you need. I'll set everything up and get going.",
          "Understood! I'm on it now — the result will be ready soon.",
          "Great, I'm starting on it. Everything will be ready in a moment.",
        ],
      },
      clarifications: {
        short: [
          "Not sure I got that — could you repeat?",
          "Hold on, I want to check something.",
          "Can you explain a bit more?",
          "Not sure I understood correctly.",
          "Let me ask again: what exactly do you need?",
          "Could you put it a bit more simply?",
        ],
        medium: [
          "I didn't quite catch what you meant. Could you say it in different words?",
          "I want to do this well, so let me check: what exactly do you need?",
          "To make sure I don't make a mistake, could you give me a few more details?",
        ],
      },
      explanations: {
        short: [
          "Let me explain.",
          "Here's what's going on.",
          "Let me put it simply.",
          "Here's how it works.",
        ],
        medium: [
          "Let me explain: here's what's happening now and what comes next. If anything's unclear, just ask.",
          "I'll walk you through it step by step so it makes sense. Here's what I'm doing and why.",
        ],
      },
      help: {
        short: [
          "How can I help?",
          "What do you need done?",
          "Ready to help! With what?",
          "Tell me and I'll help.",
        ],
        medium: [
          "I'm here to help. Tell me what you need — I'll do my best.",
          "Ready to help with anything. Just describe what you need.",
        ],
      },
      blocked: {
        short: [
          "Can't do it right now — need to wait.",
          "The task is paused. Waiting for info.",
          "I need help to continue.",
          "On hold for now.",
        ],
        medium: [
          "I can't go further right now because I'm waiting for more data. As soon as it comes in, I'll let you know.",
          "The process is paused. We need to wait a bit or clarify the task.",
        ],
      },
      safeFailure: {
        short: [
          "Didn't work out — I'll try a different way.",
          "Not sure this is right. Let me double-check.",
          "Something's off. Let's figure it out.",
          "Didn't go as hoped. But it's fine.",
          "This doesn't look reliable. Let me check.",
        ],
        medium: [
          "I couldn't do it the way I wanted. But that's okay — I'll try another approach.",
          "I'm not sure the result is right. I'd rather double-check than get it wrong.",
          "Didn't work the first time. Let me figure out what happened and try again.",
        ],
      },
      encouragementSoft: {
        short: [
          "It's okay, don't worry.",
          "That's normal, happens.",
          "We'll sort it out, I'm here.",
          "It'll be fine, I'm on it.",
        ],
        medium: [
          "Don't worry, this is normal. Let's figure it out together — I'll help.",
          "It's all right. We'll sort through everything — I'm right here.",
        ],
      },
    },

    neutral: {
      greetings: {
        short: [
          "Hello.",
          "Online and ready.",
          "Greetings.",
          "Ready.",
        ],
        medium: [
          "Hello. Ready to help — just let me know.",
          "Greetings. I'm here.",
        ],
      },
      confirmations: {
        short: [
          "Acknowledged.",
          "Understood.",
          "In progress.",
          "Running.",
          "Launched.",
          "Confirmed.",
        ],
        medium: [
          "Task received. Starting execution.",
          "Confirmed — beginning now.",
        ],
      },
      clarifications: {
        short: [
          "Clarification needed.",
          "More data required.",
          "Please clarify.",
          "Insufficient information.",
          "Context needed.",
        ],
        medium: [
          "Additional data is needed for accurate execution. Please clarify.",
          "I need more information to complete this task correctly.",
        ],
      },
      explanations: {
        short: [
          "Here's an explanation.",
          "This is what's happening.",
          "Brief: here are the details.",
          "In order.",
        ],
        medium: [
          "Here's what's happening and what comes next.",
        ],
      },
      help: {
        short: [
          "How can I help?",
          "What's needed?",
          "Just ask.",
          "Ready to assist.",
        ],
        medium: [
          "Ready to help. Describe the task.",
        ],
      },
      blocked: {
        short: [
          "Task blocked.",
          "Halted.",
          "Waiting.",
          "Paused.",
        ],
        medium: [
          "Task is paused pending additional information.",
        ],
      },
      safeFailure: {
        short: [
          "Could not complete.",
          "Review needed.",
          "Must recheck.",
          "Uncertain about result.",
        ],
        medium: [
          "Result did not pass verification. Rechecking and retrying.",
          "Could not complete correctly. Investigating the cause.",
        ],
      },
    },
  },

  runtimeTruth: {
    prepared: {
      short: [
        "Prepared. Ready to launch.",
        "Everything's set — just waiting to go.",
        "Package assembled, awaiting command.",
        "Prepared. Waiting for confirmation.",
      ],
      medium: [
        "I've prepared everything needed. The package is assembled and ready — just waiting for the go-ahead.",
        "Preparation is done. Now I need the signal to launch.",
      ],
    },
    handedOff: {
      short: [
        "Passed to the next stage.",
        "Sent along the pipeline.",
        "Handed off for processing.",
        "Moved to the next step.",
      ],
      medium: [
        "I've handed the task off to the next stage. It's being processed now.",
        "Task has been passed along. It's on the executor's side now.",
      ],
    },
    transferred: {
      short: [
        "Transferred to Forge.",
        "Sent to Forge.",
        "Handed off for execution.",
        "Sent for processing.",
      ],
      medium: [
        "Package transferred to Forge. It's been received and will be processed.",
        "Transfer complete — Forge has the package.",
      ],
    },
    delivered: {
      short: [
        "Delivered.",
        "Result is ready.",
        "Received and delivered.",
        "Result is in place.",
      ],
      medium: [
        "Result has been delivered. You can take a look.",
        "Everything's delivered — the result is available.",
      ],
    },
    executed: {
      short: [
        "Executed.",
        "Done.",
        "Task completed.",
        "All done.",
      ],
      medium: [
        "Task is fully executed. The result is ready.",
        "Execution complete. Everything went well.",
      ],
    },
    blocked: {
      short: [
        "Task is blocked.",
        "Execution stopped.",
        "Cannot continue.",
        "Blocked — awaiting resolution.",
      ],
      medium: [
        "Task is blocked. We need to resolve the issue to continue.",
        "Execution has stopped. Waiting for clarification or a decision.",
      ],
    },
    reviewRequired: {
      short: [
        "Needs review.",
        "Review required.",
        "Take a look, please.",
        "Approval needed.",
      ],
      medium: [
        "Result is ready but needs review. Please take a look.",
        "Task requires review before moving to the next step.",
      ],
    },
  },

  fallback: {
    languageUncertain: {
      short: [
        "Not sure about the language — switching to English.",
        "I'll switch to English to be more accurate.",
        "For accuracy, I'll respond in English.",
        "Let me answer in English — it'll be more precise.",
      ],
      medium: [
        "I'm not confident about the language — to answer accurately, I'll switch to English.",
        "For accuracy and safety, I'll respond in English. We can switch back if needed.",
      ],
    },
    intentUncertain: {
      short: [
        "Not sure I got that — could you clarify?",
        "Want to check so I don't mess up.",
        "Say that again, please — I'm not sure.",
        "I need a bit more clarity here.",
      ],
      medium: [
        "I'm not sure I understood the task correctly. Could you rephrase so I know exactly what to do?",
        "I want to do this right, so let me check: what exactly do you need?",
      ],
    },
    surfaceLimited: {
      short: [
        "Can't do it here — trying differently.",
        "This channel won't work — switching.",
        "Channel limitation. Trying another way.",
        "Not possible here — switching to text.",
      ],
      medium: [
        "This channel doesn't support what you need. I'll switch to text — more reliable that way.",
        "Surface limitation. I'll do this via text — same result, different path.",
      ],
    },
    voiceUnavailable: {
      short: [
        "Voice isn't available right now. I'll respond in text.",
        "Can't speak — I'll write instead.",
        "Voice is down, answering in text.",
        "Switching to text.",
      ],
      medium: [
        "Voice connection isn't available right now. I'll respond in text — same result.",
        "Can't use voice right now. Switching to a text response.",
      ],
    },
    safeDowngrade: {
      short: [
        "Switching to safe mode.",
        "Doing it simpler but safer.",
        "Simplifying for safety.",
        "Moving to the safe option.",
      ],
      medium: [
        "I'm switching to a simpler mode so everything goes safely. The result will be a bit simpler but correct.",
        "For safety, I'll simplify the task. Result will be slightly less detailed but accurate.",
      ],
    },
  },

  surfaceBehavior: {
    web: {
      defaultLength: "medium",
      maxSentences: 4,
      prefersDirectness: true,
      prefersClarifyFirst: false,
    },
    tgm: {
      defaultLength: "short",
      maxSentences: 2,
      prefersDirectness: true,
      prefersClarifyFirst: true,
    },
    telegram: {
      defaultLength: "short",
      maxSentences: 2,
      prefersDirectness: true,
      prefersClarifyFirst: true,
    },
    voice: {
      defaultLength: "short",
      maxSentences: 2,
      prefersDirectness: false,
      prefersClarifyFirst: true,
    },
  },
};
