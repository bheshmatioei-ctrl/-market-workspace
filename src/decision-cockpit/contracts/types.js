/**
 * Normalized Decision Cockpit contract types.
 *
 * This project remains dependency-free JavaScript. JSDoc provides editor/static
 * typing, while validators.js is the authoritative runtime boundary. All
 * timestamps are UTC ISO-8601 strings and every persisted top-level contract
 * carries schemaVersion.
 *
 * @typedef {{value: number|null, unit: string, missingReason: string|null}} Measurement
 * @typedef {{schemaVersion:string, sourceId:string, sourceName:string, sourceType:"official"|"exchange"|"regulator"|"vendor"|"aggregator"|"derived", observedAt:string|null, receivedAt:string|null, reportingPeriodStart?:string|null, reportingPeriodEnd?:string|null, latencyClass:"realtime"|"delayed"|"daily"|"weekly"|"monthly"|"quarterly", freshnessSeconds:number|null, isStale:boolean, qualityScore:number}} SourceMeta
 * @typedef {{schemaVersion:string, evidenceId:string, sourceMeta:SourceMeta, field:string, value:number|string|boolean|null, unit:string|null, evidenceType:"DIRECT"|"PROXY"|"DERIVED"}} EvidenceRef
 * @typedef {{schemaVersion:string, score:number, reasons:string[], degradedBy:string[]}} Confidence
 * @typedef {{schemaVersion:string, status:"LIVE"|"DELAYED"|"DEGRADED"|"STALE"|"UNAVAILABLE", assessedAt:string, ageSeconds:number|null, reason:string, decisionGrade:boolean}} FreshnessAssessment
 * @typedef {{sessionDate:string, sessionPhase:"premarket"|"regular"|"afterhours"|"overnight", sessionCalendarId:string}} SessionIdentity
 *
 * @typedef {Object} MarketSnapshot
 * @property {string} schemaVersion
 * @property {string} snapshotId
 * @property {string} timestamp
 * @property {string} sessionDate
 * @property {"premarket"|"regular"|"afterhours"|"overnight"} sessionPhase
 * @property {SessionIdentity=} sessionIdentity Required when admitted to same-session historical comparison.
 * @property {Measurement} spy
 * @property {Measurement} qqq
 * @property {Measurement} iwm
 * @property {Measurement} dia
 * @property {Measurement} vix
 * @property {Measurement} ust2y
 * @property {Measurement} ust10y
 * @property {Measurement} dxy
 * @property {Measurement} gold
 * @property {Measurement} oil
 * @property {Measurement|null} bitcoinOptional
 * @property {FreshnessAssessment} freshness
 * @property {EvidenceRef[]} evidenceRefs
 *
 * @typedef {Object} PredictionRecord
 * @property {string} schemaVersion
 * @property {string} predictionId
 * @property {string} issuedAt
 * @property {string} scope
 * @property {string} symbolOrScopeId
 * @property {string} modelVersion
 * @property {string} horizon
 * @property {Measurement|null} referencePrice
 * @property {string} predictedDirection
 * @property {number|null} expectedMoveLowPct
 * @property {number|null} expectedMoveHighPct
 * @property {Confidence} confidence
 * @property {string} marketRegimeAtIssue
 * @property {string} evidenceSnapshotHash
 * @property {EvidenceRef[]} evidenceRefs
 *
 * Other normalized contracts are validated by name in validators.js:
 * BreadthSnapshot, SectorSnapshot, StockSnapshot, AssetFlowSnapshot,
 * CountryFlowSnapshot, PremarketSnapshot, CatalystEvent, Alert,
 * DecisionState, TradeDecisionZone and PredictionOutcome.
 *
 * Package 002 additive engine-output contracts:
 * @typedef {{engineId:string, engineVersion:string, lifecycle:"OFF"|"SHADOW"|"BETA"|"ACTIVE", evaluatedAt:string, inputSchemaVersions:Record<string,string>, ruleProfileId:string, deterministic:boolean}} EngineMeta
 * @typedef {{schemaVersion:string, assessmentId:string, timestamp:string, scope:"MARKET"|"SECTOR"|"STOCK", scopeId:string, horizon:"30m"|"60m"|"120m"|"SESSION", direction:"IMPROVING"|"STABLE"|"DETERIORATING"|"UNKNOWN", score:number|null, trafficLight:"GREEN"|"ORANGE"|"RED"|"GREY", confidence:Confidence, supportingEvidence:EvidenceRef[], opposingEvidence:EvidenceRef[], freshness:FreshnessAssessment, engineMeta:EngineMeta}} DirectionAssessment
 * @typedef {{schemaVersion:string, assessmentId:string, timestamp:string, scope:"MARKET"|"SECTOR"|"ASSET_CLASS", scopeId:string, flowMode:"DIRECT"|"PROXY"|"MIXED", state:"DEMAND"|"SELLING_PRESSURE"|"MIXED"|"NEUTRAL"|"INSUFFICIENT", trafficLight:"GREEN"|"ORANGE"|"RED"|"GREY", score:number|null, directFlowValue:number|null, currency:string|null, reportingPeriod:string|null, confidence:Confidence, directEvidence:EvidenceRef[], proxyEvidence:EvidenceRef[], opposingEvidence:EvidenceRef[], freshness:FreshnessAssessment, engineMeta:EngineMeta}} FlowAssessment
 * @typedef {{schemaVersion:string, assessmentId:string, timestamp:string, countryOrRegion:string, horizon:"overnight"|"1d"|"5d"|"1m"|"structural", state:"POSITIVE_ROTATION"|"NEGATIVE_ROTATION"|"MIXED"|"NEUTRAL"|"INSUFFICIENT", trafficLight:"GREEN"|"ORANGE"|"RED"|"GREY", score:number|null, equityState:string, bondState:string, fxState:string, relativeStrengthState:string, directFlowState:string, directFlowValue:number|null, directFlowCurrency:string|null, confidence:Confidence, directEvidence:EvidenceRef[], proxyEvidence:EvidenceRef[], opposingEvidence:EvidenceRef[], freshness:FreshnessAssessment, engineMeta:EngineMeta}} GlobalRotationAssessment
 * @typedef {{schemaVersion:string, bundleId:string, timestamp:string, marketDecisionState:Object|null, directionAssessments:DirectionAssessment[], sectorFlowAssessments:FlowAssessment[], assetFlowAssessments:FlowAssessment[], globalRotationAssessments:GlobalRotationAssessment[], conflicts:string[], warnings:string[], sourceSnapshotIds:string[], generatedBy:EngineMeta[]}} MarketContextBundle
 */

export {};
