# Ecuador Local Presence & Entity Requirements

**Status:** Counsel checklist derived from public regulatory sources and AnyMarket launch posture — **not legal advice.**

**Purpose:** Determine whether a foreign operator must establish Ecuadorian legal presence to serve EC-resident users with Live wallet features.

---

## 1. Why local presence matters

The June 2026 **Reglamento General** for *pronósticos deportivos* emphasizes, for licensed operators:

- legal existence and valid representation;
- corporate purpose compatible with the activity;
- tax compliance (SRI);
- patrimonial capacity;
- domain / platform control;
- technical certification.

Even if counsel concludes AnyMarket is **outside LOPD**, Ecuador may still require local presence for:

- tax registration and withholding;
- UAFE reporting entity enrollment;
- LOPDP representative / DPD requirements;
- consumer dispute forums under Ecuador law (EC Terms reference Ecuador forums);
- payment provider rules (Stripe Connect `country=EC`).

---

## 2. Decision matrix (counsel to complete)

| Scenario | Likely need | Counsel conclusion |
|----------|-------------|-------------------|
| **A.** Non-LOPD, limited beta, Stripe EC Connect | Foreign parent + Stripe onboarding only? | _Pending_ |
| **B.** Non-LOPD, full public launch | Branch or local S.A. / Cía. Ltda.? | _Pending_ |
| **C.** LOPD licensed sports operator | Local entity + LOPD licence + domicile | Required if LOPD applies |
| **D.** UAFE reporting entity | Registered address / representative in Ecuador? | _Pending_ |

---

## 3. Entity options (typical — counsel to advise)

| Structure | Pros | Cons | AnyMarket notes |
|-----------|------|------|-----------------|
| **Ecuadorian subsidiary** (S.A. / Ltda.) | Clear local contracting, tax, employment | Setup cost, ongoing compliance | Preferred if counsel requires local operator of record |
| **Branch of foreign company** | Single group entity | Registration burden, liability exposure | Verify if permitted for digital services |
| **Contractual agent / representative** | Lower cost | May be insufficient for licensed activity | Possible for pre-launch beta only? |
| **Foreign parent only** | Simplest structurally | May fail LOPD / tax / UAFE expectations | Current engineering assumes residence lock + Stripe EC |

**Counsel recommendation:** _______________

---

## 4. Document checklist for local entity (if required)

### 4.1 Corporate

- [ ] Certificate of incorporation (local or apostilled foreign + registration)
- [ ] Bylaws / estatutos compatible with platform activity
- [ ] Board resolution authorizing Ecuador operations
- [ ] Legal representative cédula / powers
- [ ] Registered office address in Ecuador

### 4.2 Tax (SRI)

- [ ] RUC obtainment
- [ ] Tax regime classification (IRU vs general — counsel)
- [ ] Withholding agent registration if prize withholding applies
- [ ] Digital services / VAT registration if applicable
- [ ] Accounting records in Spanish where required

### 4.3 Regulatory

- [ ] LOPD application (Ministerio del Deporte) — **only if classified as pronósticos deportivos**
- [ ] UAFE enrollment — if counsel confirms
- [ ] SPDP / LOPDP registration or DPD appointment — if required
- [ ] Platform / domain control evidence for regulator requests

### 4.4 Payments

- [ ] Stripe Connect platform agreement for Ecuador
- [ ] Bank account / payout pathway for local entity if required
- [ ] MoonPay eligibility for EC users under local entity

---

## 5. Foreign operator interim posture (current engineering)

Until counsel confirms entity structure:

1. **Beta only:** `EXPO_PUBLIC_BETA_REQUIRED=true`, invite list in `beta_invites`
2. **Residence lock:** EC users mapped to `EC` compliance jurisdiction
3. **No sports markets** for EC (server-enforced)
4. **Spanish-primary** EC legal policies in app
5. **Support workflow** for country changes (no self-service) — Stripe Connect re-onboarding required

---

## 6. Timeline alignment

| Milestone | Dependency |
|-----------|------------|
| Private beta (engineering) | Can proceed with counsel review parallel |
| Public real-money EC launch | Entity + UAFE + tax + classification memos signed |
| LOPD path (if applicable) | Local entity, licence fee budget (~655 SBU/year), 90-day regularization if already operating |

---

## 7. Sign-off

| Item | Counsel | Date |
|------|---------|------|
| Required entity type | | |
| RUC required before beta? | | |
| Legal representative required? | | |
| DPD / LOPDP registration required? | | |

**Counsel signature:** _______________

---

## Related docs

- [ec-counsel-launch-checklist.md](./ec-counsel-launch-checklist.md) — master counsel gate
- [ec-product-classification-memo.md](./ec-product-classification-memo.md) — LOPD vs non-sports
- [ec-uafe-sri-compliance-runbook.md](./ec-uafe-sri-compliance-runbook.md) — UAFE / tax
- [ec-beta-e2e-checklist.md](./ec-beta-e2e-checklist.md) — engineering QA before beta expansion
