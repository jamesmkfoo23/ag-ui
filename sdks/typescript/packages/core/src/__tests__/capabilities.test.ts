import {
  AgentCapabilitiesSchema,
  ExecutionCapabilitiesSchema,
  HumanInTheLoopCapabilitiesSchema,
  IdentityCapabilitiesSchema,
  MultiAgentCapabilitiesSchema,
  MultimodalCapabilitiesSchema,
  MultimodalInputCapabilitiesSchema,
  MultimodalOutputCapabilitiesSchema,
  OutputCapabilitiesSchema,
  ReasoningCapabilitiesSchema,
  StateCapabilitiesSchema,
  SubAgentInfoSchema,
  ToolsCapabilitiesSchema,
  TransportCapabilitiesSchema,
} from "../capabilities";

describe("SubAgentInfoSchema", () => {
  it("parses a sub-agent with name only", () => {
    const result = SubAgentInfoSchema.safeParse({ name: "search-agent" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("search-agent");
  });

  it("parses a sub-agent with name and description", () => {
    const result = SubAgentInfoSchema.safeParse({
      name: "code-agent",
      description: "Writes and reviews code",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("code-agent");
      expect(result.data.description).toBe("Writes and reviews code");
    }
  });

  it("fails when name is missing", () => {
    const result = SubAgentInfoSchema.safeParse({ description: "no name" });
    expect(result.success).toBe(false);
  });
});

describe("IdentityCapabilitiesSchema", () => {
  it("parses an empty object (all fields optional)", () => {
    expect(IdentityCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses a fully-populated identity", () => {
    const result = IdentityCapabilitiesSchema.safeParse({
      name: "My Agent",
      type: "langgraph",
      description: "Does things",
      version: "1.2.3",
      provider: "Acme Corp",
      documentationUrl: "https://example.com/docs",
      metadata: { region: "us-east-1" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("My Agent");
      expect(result.data.type).toBe("langgraph");
      expect(result.data.version).toBe("1.2.3");
      expect(result.data.metadata).toEqual({ region: "us-east-1" });
    }
  });

  it("parses when only name is provided", () => {
    const result = IdentityCapabilitiesSchema.safeParse({ name: "Minimal Agent" });
    expect(result.success).toBe(true);
  });
});

describe("TransportCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(TransportCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses all transport flags set to true", () => {
    const result = TransportCapabilitiesSchema.safeParse({
      streaming: true,
      websocket: true,
      httpBinary: true,
      pushNotifications: true,
      resumable: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.streaming).toBe(true);
      expect(result.data.websocket).toBe(true);
      expect(result.data.httpBinary).toBe(true);
      expect(result.data.pushNotifications).toBe(true);
      expect(result.data.resumable).toBe(true);
    }
  });

  it("parses with only streaming enabled", () => {
    const result = TransportCapabilitiesSchema.safeParse({ streaming: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.streaming).toBe(true);
  });

  it("fails when a flag is not a boolean", () => {
    const result = TransportCapabilitiesSchema.safeParse({ streaming: "yes" });
    expect(result.success).toBe(false);
  });
});

describe("ToolsCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(ToolsCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses with supported flag", () => {
    const result = ToolsCapabilitiesSchema.safeParse({
      supported: true,
      parallelCalls: false,
      clientProvided: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supported).toBe(true);
      expect(result.data.parallelCalls).toBe(false);
    }
  });

  it("parses with an items array", () => {
    const result = ToolsCapabilitiesSchema.safeParse({
      supported: true,
      items: [
        {
          name: "web_search",
          description: "Search the web",
          parameters: { type: "object", properties: {} },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items![0].name).toBe("web_search");
    }
  });
});

describe("OutputCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(OutputCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses structured output with MIME types", () => {
    const result = OutputCapabilitiesSchema.safeParse({
      structuredOutput: true,
      supportedMimeTypes: ["application/json", "text/plain"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.structuredOutput).toBe(true);
      expect(result.data.supportedMimeTypes).toEqual(["application/json", "text/plain"]);
    }
  });
});

describe("StateCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(StateCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses all state flags", () => {
    const result = StateCapabilitiesSchema.safeParse({
      snapshots: true,
      deltas: true,
      memory: false,
      persistentState: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.snapshots).toBe(true);
      expect(result.data.deltas).toBe(true);
      expect(result.data.memory).toBe(false);
      expect(result.data.persistentState).toBe(true);
    }
  });
});

describe("MultiAgentCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(MultiAgentCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses with sub-agents list", () => {
    const result = MultiAgentCapabilitiesSchema.safeParse({
      supported: true,
      delegation: true,
      handoffs: false,
      subAgents: [{ name: "child-agent", description: "Does subtasks" }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subAgents).toHaveLength(1);
      expect(result.data.subAgents![0].name).toBe("child-agent");
    }
  });

  it("fails when sub-agent name is missing", () => {
    const result = MultiAgentCapabilitiesSchema.safeParse({
      subAgents: [{ description: "no name" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("ReasoningCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(ReasoningCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses all reasoning flags", () => {
    const result = ReasoningCapabilitiesSchema.safeParse({
      supported: true,
      streaming: true,
      encrypted: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supported).toBe(true);
      expect(result.data.streaming).toBe(true);
      expect(result.data.encrypted).toBe(false);
    }
  });
});

describe("MultimodalInputCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(MultimodalInputCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses all modalities enabled", () => {
    const result = MultimodalInputCapabilitiesSchema.safeParse({
      image: true,
      audio: true,
      video: true,
      pdf: true,
      file: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image).toBe(true);
      expect(result.data.audio).toBe(true);
      expect(result.data.video).toBe(true);
      expect(result.data.pdf).toBe(true);
      expect(result.data.file).toBe(true);
    }
  });

  it("parses with only image enabled", () => {
    const result = MultimodalInputCapabilitiesSchema.safeParse({ image: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.image).toBe(true);
  });
});

describe("MultimodalOutputCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(MultimodalOutputCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses image and audio output enabled", () => {
    const result = MultimodalOutputCapabilitiesSchema.safeParse({
      image: true,
      audio: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.image).toBe(true);
      expect(result.data.audio).toBe(false);
    }
  });
});

describe("MultimodalCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(MultimodalCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses nested input and output capabilities", () => {
    const result = MultimodalCapabilitiesSchema.safeParse({
      input: { image: true, audio: false, video: false, pdf: true, file: true },
      output: { image: true, audio: false },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.input?.image).toBe(true);
      expect(result.data.output?.image).toBe(true);
    }
  });
});

describe("ExecutionCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(ExecutionCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses code execution with limits", () => {
    const result = ExecutionCapabilitiesSchema.safeParse({
      codeExecution: true,
      sandboxed: true,
      maxIterations: 10,
      maxExecutionTime: 30000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.codeExecution).toBe(true);
      expect(result.data.sandboxed).toBe(true);
      expect(result.data.maxIterations).toBe(10);
      expect(result.data.maxExecutionTime).toBe(30000);
    }
  });

  it("fails when maxIterations is not a number", () => {
    const result = ExecutionCapabilitiesSchema.safeParse({ maxIterations: "ten" });
    expect(result.success).toBe(false);
  });
});

describe("HumanInTheLoopCapabilitiesSchema", () => {
  it("parses an empty object", () => {
    expect(HumanInTheLoopCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses all HITL flags", () => {
    const result = HumanInTheLoopCapabilitiesSchema.safeParse({
      supported: true,
      approvals: true,
      interventions: false,
      feedback: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.supported).toBe(true);
      expect(result.data.approvals).toBe(true);
      expect(result.data.interventions).toBe(false);
      expect(result.data.feedback).toBe(true);
    }
  });
});

describe("AgentCapabilitiesSchema", () => {
  it("parses an empty object (fully optional)", () => {
    expect(AgentCapabilitiesSchema.safeParse({}).success).toBe(true);
  });

  it("parses a minimal agent with only identity", () => {
    const result = AgentCapabilitiesSchema.safeParse({
      identity: { name: "Simple Agent" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identity?.name).toBe("Simple Agent");
    }
  });

  it("parses a fully-populated agent capabilities object", () => {
    const result = AgentCapabilitiesSchema.safeParse({
      identity: {
        name: "Full Agent",
        type: "mastra",
        version: "2.0.0",
        provider: "Acme",
      },
      transport: { streaming: true, websocket: false },
      tools: { supported: true, parallelCalls: true, clientProvided: true },
      output: { structuredOutput: true },
      state: { snapshots: true, deltas: true, memory: true, persistentState: true },
      multiAgent: {
        supported: true,
        delegation: true,
        handoffs: true,
        subAgents: [{ name: "sub-1" }],
      },
      reasoning: { supported: true, streaming: true, encrypted: false },
      multimodal: {
        input: { image: true, audio: true, video: false, pdf: false, file: false },
        output: { image: false, audio: false },
      },
      execution: { codeExecution: true, sandboxed: true, maxIterations: 5 },
      humanInTheLoop: { supported: true, approvals: true },
      custom: { proprietary_flag: true },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.identity?.name).toBe("Full Agent");
      expect(result.data.transport?.streaming).toBe(true);
      expect(result.data.tools?.supported).toBe(true);
      expect(result.data.state?.persistentState).toBe(true);
      expect(result.data.multiAgent?.subAgents).toHaveLength(1);
      expect(result.data.reasoning?.streaming).toBe(true);
      expect(result.data.multimodal?.input?.image).toBe(true);
      expect(result.data.execution?.maxIterations).toBe(5);
      expect(result.data.humanInTheLoop?.approvals).toBe(true);
      expect(result.data.custom).toEqual({ proprietary_flag: true });
    }
  });

  it("strips unknown top-level keys", () => {
    const result = AgentCapabilitiesSchema.safeParse({
      identity: { name: "Agent" },
      unknownKey: "should be stripped",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect("unknownKey" in result.data).toBe(false);
    }
  });

  it("fails when a nested field has the wrong type", () => {
    const result = AgentCapabilitiesSchema.safeParse({
      execution: { maxIterations: "not-a-number" },
    });
    expect(result.success).toBe(false);
  });
});
