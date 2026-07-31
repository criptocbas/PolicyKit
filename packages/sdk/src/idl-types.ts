/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/policykit.json`.
 */
export type Policykit = {
  "address": "4KSYqUXxHrgMyyAnF56Gwir44Gt9NB49gE43pkPvCYeu",
  "metadata": {
    "name": "policykit",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "PolicyKit — open Solana-native on-chain policy engine for AI agents"
  },
  "instructions": [
    {
      "name": "clawback",
      "docs": [
        "Authority withdraws from the vault (works while paused)."
      ],
      "discriminator": [
        111,
        92,
        142,
        79,
        33,
        234,
        82,
        27
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "destinationToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "createPolicy",
      "docs": [
        "Initialize a new policy PDA.",
        "",
        "Security: `authority` signs and becomes the immutable owner encoded in",
        "PDA seeds. Reinitialization is prevented by `init`."
      ],
      "discriminator": [
        27,
        81,
        33,
        27,
        196,
        103,
        246,
        53
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "authority"
              },
              {
                "kind": "arg",
                "path": "policyId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "policyId",
          "type": "u64"
        },
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "createPolicyParams"
            }
          }
        }
      ]
    },
    {
      "name": "deposit",
      "docs": [
        "Fund the policy vault (anyone may deposit)."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "depositor",
          "signer": true
        },
        {
          "name": "policy",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "depositorToken",
          "writable": true
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "executeSpend",
      "docs": [
        "Agent spend under full policy enforcement.",
        "",
        "`intent_program` is checked against allow/deny lists. See program design docs."
      ],
      "discriminator": [
        97,
        195,
        2,
        242,
        205,
        203,
        109,
        210
      ],
      "accounts": [
        {
          "name": "agent",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        },
        {
          "name": "mint"
        },
        {
          "name": "vaultToken",
          "writable": true
        },
        {
          "name": "destinationToken",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "intentProgram",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "pausePolicy",
      "docs": [
        "Freeze spends. Clawback still works."
      ],
      "discriminator": [
        162,
        125,
        168,
        118,
        196,
        17,
        113,
        165
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "setAgent",
      "docs": [
        "Rotate the agent hot key.",
        "",
        "Security: authority only; old agent loses spend rights immediately."
      ],
      "discriminator": [
        154,
        74,
        121,
        91,
        137,
        19,
        101,
        166
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "newAgent",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unpausePolicy",
      "docs": [
        "Resume spends after pause."
      ],
      "discriminator": [
        114,
        203,
        164,
        147,
        27,
        2,
        3,
        99
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updatePolicy",
      "docs": [
        "Update mutable rules (limits, lists, expiry). Not authority/agent/spend_mint.",
        "",
        "Security: authority signer + PDA seeds + has_one."
      ],
      "discriminator": [
        212,
        245,
        246,
        7,
        163,
        151,
        18,
        57
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "policy"
          ]
        },
        {
          "name": "policy",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  108,
                  105,
                  99,
                  121
                ]
              },
              {
                "kind": "account",
                "path": "policy.authority",
                "account": "policy"
              },
              {
                "kind": "account",
                "path": "policy.policy_id",
                "account": "policy"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "updatePolicyParams"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "policy",
      "discriminator": [
        222,
        135,
        7,
        163,
        235,
        177,
        33,
        68
      ]
    }
  ],
  "events": [
    {
      "name": "agentUpdated",
      "discriminator": [
        210,
        179,
        162,
        250,
        123,
        250,
        210,
        166
      ]
    },
    {
      "name": "clawbackExecuted",
      "discriminator": [
        119,
        40,
        15,
        252,
        119,
        243,
        188,
        239
      ]
    },
    {
      "name": "depositReceived",
      "discriminator": [
        9,
        208,
        152,
        63,
        64,
        32,
        185,
        118
      ]
    },
    {
      "name": "policyCreated",
      "discriminator": [
        59,
        189,
        65,
        121,
        86,
        157,
        108,
        10
      ]
    },
    {
      "name": "policyPausedEvent",
      "discriminator": [
        177,
        194,
        231,
        149,
        172,
        227,
        77,
        106
      ]
    },
    {
      "name": "policyUnpausedEvent",
      "discriminator": [
        82,
        225,
        126,
        6,
        42,
        237,
        238,
        209
      ]
    },
    {
      "name": "policyUpdated",
      "discriminator": [
        225,
        112,
        112,
        67,
        95,
        236,
        245,
        161
      ]
    },
    {
      "name": "spendExecuted",
      "discriminator": [
        27,
        251,
        149,
        186,
        175,
        148,
        73,
        5
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "policyPaused",
      "msg": "Policy is paused"
    },
    {
      "code": 6001,
      "name": "policyExpired",
      "msg": "Policy has expired"
    },
    {
      "code": 6002,
      "name": "unauthorizedAuthority",
      "msg": "Signer is not the policy authority"
    },
    {
      "code": 6003,
      "name": "unauthorizedAgent",
      "msg": "Signer is not the policy agent"
    },
    {
      "code": 6004,
      "name": "exceedsPerTransactionLimit",
      "msg": "Amount exceeds per-transaction spend limit"
    },
    {
      "code": 6005,
      "name": "exceedsDailyLimit",
      "msg": "Amount would exceed daily spend limit"
    },
    {
      "code": 6006,
      "name": "rateLimitExceeded",
      "msg": "Rate limit exceeded for this time window"
    },
    {
      "code": 6007,
      "name": "programNotAllowed",
      "msg": "Intent program is not on the allowlist"
    },
    {
      "code": 6008,
      "name": "programDenied",
      "msg": "Intent program is on the denylist"
    },
    {
      "code": 6009,
      "name": "mintNotAllowed",
      "msg": "Mint is not on the allowlist"
    },
    {
      "code": 6010,
      "name": "zeroAmount",
      "msg": "Transfer amount must be greater than zero"
    },
    {
      "code": 6011,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6012,
      "name": "programListTooLong",
      "msg": "Program list exceeds maximum length"
    },
    {
      "code": 6013,
      "name": "mintListTooLong",
      "msg": "Mint list exceeds maximum length"
    },
    {
      "code": 6014,
      "name": "emptyProgramAllowlist",
      "msg": "Program allowlist enabled but empty"
    },
    {
      "code": 6015,
      "name": "emptyMintAllowlist",
      "msg": "Mint allowlist enabled but empty"
    },
    {
      "code": 6016,
      "name": "invalidRateWindow",
      "msg": "Rate limit requires window_seconds > 0"
    },
    {
      "code": 6017,
      "name": "invalidExpiry",
      "msg": "expires_at must be 0 (never) or in the future"
    },
    {
      "code": 6018,
      "name": "insufficientVaultBalance",
      "msg": "Insufficient vault balance"
    },
    {
      "code": 6019,
      "name": "mintMismatch",
      "msg": "Token account mint mismatch"
    },
    {
      "code": 6020,
      "name": "invalidVaultAuthority",
      "msg": "Vault token account authority must be the policy PDA"
    }
  ],
  "types": [
    {
      "name": "agentUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "oldAgent",
            "type": "pubkey"
          },
          {
            "name": "newAgent",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "clawbackExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "createPolicyParams",
      "docs": [
        "Parameters for creating a policy."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "expiresAt",
            "docs": [
              "`0` = never expires."
            ],
            "type": "i64"
          },
          {
            "name": "spendMint",
            "type": "pubkey"
          },
          {
            "name": "maxPerTransaction",
            "type": "u64"
          },
          {
            "name": "maxPerDay",
            "type": "u64"
          },
          {
            "name": "maxActionsPerWindow",
            "type": "u32"
          },
          {
            "name": "windowSeconds",
            "type": "u32"
          },
          {
            "name": "programAllowlistEnabled",
            "type": "bool"
          },
          {
            "name": "programAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "programDenylistEnabled",
            "type": "bool"
          },
          {
            "name": "programDenylist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "mintAllowlistEnabled",
            "type": "bool"
          },
          {
            "name": "mintAllowlist",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "depositReceived",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "depositor",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "policy",
      "docs": [
        "On-chain policy: rules, counters, and vault authority.",
        "",
        "PDA seeds: `[\"policy\", authority, policy_id.to_le_bytes()]`",
        "",
        "Security model:",
        "- Token vault ATAs use this PDA as authority.",
        "- Only `execute_spend` (agent) and `clawback` (authority) move funds out.",
        "- All limit / allowlist checks run before any transfer CPI."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "docs": [
              "Human or protocol that can update, pause, clawback, rotate agent."
            ],
            "type": "pubkey"
          },
          {
            "name": "agent",
            "docs": [
              "Hot key authorized to call `execute_spend`."
            ],
            "type": "pubkey"
          },
          {
            "name": "policyId",
            "docs": [
              "Unique id under `authority` (PDA seed)."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "Canonical bump for the policy PDA."
            ],
            "type": "u8"
          },
          {
            "name": "paused",
            "docs": [
              "When true, `execute_spend` always fails."
            ],
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "Unix timestamp after which spends fail. `0` = never expires."
            ],
            "type": "i64"
          },
          {
            "name": "spendMint",
            "docs": [
              "Mint used for spend accounting (immutable after create)."
            ],
            "type": "pubkey"
          },
          {
            "name": "maxPerTransaction",
            "docs": [
              "Max amount of `spend_mint` per single spend. `0` = unlimited."
            ],
            "type": "u64"
          },
          {
            "name": "maxPerDay",
            "docs": [
              "Max amount of `spend_mint` per day window. `0` = unlimited."
            ],
            "type": "u64"
          },
          {
            "name": "spentToday",
            "docs": [
              "Amount of `spend_mint` spent in the current day window."
            ],
            "type": "u64"
          },
          {
            "name": "dayStartTs",
            "docs": [
              "Start of the current day accounting window."
            ],
            "type": "i64"
          },
          {
            "name": "totalSpent",
            "docs": [
              "Lifetime `spend_mint` spent through this policy."
            ],
            "type": "u64"
          },
          {
            "name": "maxActionsPerWindow",
            "docs": [
              "Max actions per rate window. `0` = unlimited."
            ],
            "type": "u32"
          },
          {
            "name": "windowSeconds",
            "docs": [
              "Rate window length in seconds. Required `> 0` if rate limit enabled."
            ],
            "type": "u32"
          },
          {
            "name": "actionsInWindow",
            "docs": [
              "Actions recorded in the current rate window."
            ],
            "type": "u32"
          },
          {
            "name": "windowStartTs",
            "docs": [
              "Start of the current rate window."
            ],
            "type": "i64"
          },
          {
            "name": "programAllowlistEnabled",
            "type": "bool"
          },
          {
            "name": "programAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "programDenylistEnabled",
            "type": "bool"
          },
          {
            "name": "programDenylist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "mintAllowlistEnabled",
            "type": "bool"
          },
          {
            "name": "mintAllowlist",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    },
    {
      "name": "policyCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "policyId",
            "type": "u64"
          },
          {
            "name": "spendMint",
            "type": "pubkey"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "policyPausedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "policyUnpausedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "policyUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "spendExecuted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "policy",
            "type": "pubkey"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "intentProgram",
            "type": "pubkey"
          },
          {
            "name": "remainingDaily",
            "docs": [
              "Remaining daily budget for spend_mint; u64::MAX if unlimited or non-spend mint."
            ],
            "type": "u64"
          },
          {
            "name": "actionsInWindow",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "updatePolicyParams",
      "docs": [
        "Parameters for updating mutable policy rules (not authority, agent, id, spend_mint)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "expiresAt",
            "docs": [
              "`0` = never expires."
            ],
            "type": "i64"
          },
          {
            "name": "maxPerTransaction",
            "type": "u64"
          },
          {
            "name": "maxPerDay",
            "type": "u64"
          },
          {
            "name": "maxActionsPerWindow",
            "type": "u32"
          },
          {
            "name": "windowSeconds",
            "type": "u32"
          },
          {
            "name": "programAllowlistEnabled",
            "type": "bool"
          },
          {
            "name": "programAllowlist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "programDenylistEnabled",
            "type": "bool"
          },
          {
            "name": "programDenylist",
            "type": {
              "vec": "pubkey"
            }
          },
          {
            "name": "mintAllowlistEnabled",
            "type": "bool"
          },
          {
            "name": "mintAllowlist",
            "type": {
              "vec": "pubkey"
            }
          }
        ]
      }
    }
  ]
};
