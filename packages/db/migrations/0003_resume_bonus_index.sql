CREATE UNIQUE INDEX "XpLedger_resume_bonus_key" ON "XpLedger"(
    "userId",
    "gameDate",
    "reason"
) WHERE "reason" = 'RESUME_BONUS';
