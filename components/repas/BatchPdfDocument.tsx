import type { CSSProperties, ReactNode } from "react";
import type { BatchSession, NumberedRecipe } from "@/lib/batch-from-plan";
import { vegFamilyLabel } from "@/lib/batch-from-plan";
import { cookScale } from "@/lib/qty-scale";
import {
  appliancesLine,
  cellSetting,
  blockHowto,
  groupedCellIngredients,
  compactPasAPas,
  itemQuantityLine,
  proseList,
  qtyCaption,
  shortCoverDays,
  splitRecipeParts,
  visualPhrase,
  packingLists,
  assemblyHowto,
  stackedSauceLines,
} from "@/lib/s34-copy";
import type { BatchStepRecipeBlock } from "@/lib/types";

const PAGE_W = 720;
const PAGE_H = 1018;

const page: CSSProperties = {
  width: PAGE_W,
  height: PAGE_H,
  overflow: "hidden",
  padding: "28px 36px 22px",
  background: "#FBF7F0",
  color: "#1C1C1E",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Helvetica Neue, sans-serif",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

const muted: CSSProperties = { color: "#6E6E73", fontSize: 12, lineHeight: 1.4, margin: 0 };
const h1: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: -0.35,
  margin: "4px 0 0",
  lineHeight: 1.15,
};
const h2: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  margin: "12px 0 5px",
  letterSpacing: 0.15,
};
const body: CSSProperties = { fontSize: 12.5, lineHeight: 1.42, margin: "0 0 4px", color: "#1C1C1E" };

const TAG_COLORS = ["#E25538", "#4F5FE0", "#B45309", "#0369A1", "#BE123C", "#0F766E"];

function tagColor(recipeNo: string) {
  const n = Number(recipeNo.replace(/\D/g, "")) || 1;
  return TAG_COLORS[(n - 1) % TAG_COLORS.length];
}

function PdfTag({ recipeNo }: { recipeNo: string }) {
  const color = tagColor(recipeNo);
  return (
    <span
      style={{
        display: "inline-block",
        minWidth: 28,
        textAlign: "center",
        fontSize: 11,
        fontWeight: 700,
        color,
        background: `${color}22`,
        borderRadius: 6,
        padding: "2px 6px",
      }}
    >
      {recipeNo}
    </span>
  );
}

function PdfTable({
  headers,
  rows,
  headBg,
  headColor,
  perItem,
  groupByFamily,
}: {
  headers: [string, string, string];
  rows: BatchStepRecipeBlock[];
  headBg: string;
  headColor: string;
  perItem?: boolean;
  groupByFamily?: boolean;
}) {
  return (
    <div style={{ marginTop: 4, borderRadius: 10, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "42px 1fr 100px",
          gap: "0 8px",
          padding: "6px 8px",
          background: headBg,
          color: headColor,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        }}
      >
        <span>{headers[0]}</span>
        <span>{headers[1]}</span>
        <span style={{ textAlign: "right" }}>{headers[2]}</span>
      </div>
      {rows.map((block, index) => {
        const family = groupByFamily && perItem ? vegFamilyLabel(block.ingredients[0]?.name ?? "") : "";
        const prevFamily = groupByFamily && perItem ? vegFamilyLabel(rows[index - 1]?.ingredients[0]?.name ?? "") : "";
        const showFamily = Boolean(groupByFamily && perItem && family && family !== prevFamily);
        return (
        <div key={`${block.recipeNo}-${index}`}>
          {showFamily ? (
            <p
              style={{
                margin: "6px 8px 2px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                color: "#92400E",
              }}
            >
              {family}
            </p>
          ) : null}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "42px 1fr 100px",
            gap: "0 8px",
            padding: "6px 8px",
            background: index % 2 === 1 ? "rgba(255,255,255,0.7)" : "transparent",
            fontSize: 12,
            lineHeight: 1.35,
            alignItems: "start",
          }}
        >
          <PdfTag recipeNo={block.recipeNo} />
          {perItem ? (
            <span>
              {block.ingredients.length > 0
                ? block.ingredients.map((ing) => itemQuantityLine(ing)).join(" · ")
                : "—"}
            </span>
          ) : (
          <div>
            {groupedCellIngredients(block.ingredients).length === 0 ? (
              "—"
            ) : (
              groupedCellIngredients(block.ingredients).map((row) => (
                <div key={`${block.recipeNo}-${row.label}`} style={{ marginBottom: 2 }}>
                  <b
                    style={{
                      color:
                        row.label === "Alexis" ? "#E25538" : row.label === "Élodie" ? "#4F5FE0" : "#6E6E73",
                    }}
                  >
                    {row.label} :{" "}
                  </b>
                  {row.text}
                </div>
              ))
            )}
            {blockHowto(block) ? (
              <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.35, color: "#6E6E73" }}>
                {blockHowto(block)}
              </div>
            ) : null}
          </div>
          )}
          <span style={{ textAlign: "right", fontWeight: 650 }}>{cellSetting(block) || "—"}</span>
        </div>
        </div>
        );
      })}
    </div>
  );
}

function PdfSauceList({ rows }: { rows: BatchStepRecipeBlock[] }) {
  return (
    <div style={{ marginTop: 4, borderRadius: 10, overflow: "hidden" }}>
      {rows.map((block, index) => {
        const lines = stackedSauceLines(block.ingredients);
        return (
          <div
            key={`${block.recipeNo}-${index}`}
            style={{
              display: "flex",
              gap: 8,
              padding: "8px 10px",
              background: index % 2 === 1 ? "rgba(255,255,255,0.7)" : "transparent",
              alignItems: "flex-start",
            }}
          >
            <PdfTag recipeNo={block.recipeNo} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {lines.length === 0 ? (
                <span style={{ fontSize: 12, color: "#6E6E73" }}>—</span>
              ) : (
                lines.map((line, lineIndex) => (
                  <div
                    key={`${block.recipeNo}-${line.name}-${lineIndex}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 12,
                      lineHeight: 1.4,
                      marginTop: 1,
                    }}
                  >
                    <span>{line.name}</span>
                    <span style={{ fontWeight: 650, color: "#6E6E73", flexShrink: 0 }}>{line.qty}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PdfPage({ children, footer }: { children: ReactNode; footer: string }) {
  return (
    <div data-pdf-page style={page}>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <p style={{ ...muted, marginTop: 10, fontSize: 10 }}>{footer}</p>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: "#5B6CFF",
        border: "1px solid #C9D1FF",
        borderRadius: 6,
        padding: "2px 7px",
        marginBottom: 6,
      }}
    >
      {children}
    </span>
  );
}

function RecipeBody({ meal, continued }: { meal: NumberedRecipe; continued?: boolean }) {
  const scale = cookScale(meal, "batch");
  const parts = splitRecipeParts(meal);
  const steps = compactPasAPas(meal);
  const needsSplit = steps.length > 4 && parts.sauce.length + parts.base.length > 10;
  const shown = continued ? steps.slice(2) : needsSplit ? steps.slice(0, 2) : steps;

  return (
    <>
      {continued ? (
        <p style={{ ...muted, fontWeight: 700, marginBottom: 8, color: "#5B6CFF" }}>
          Suite · {meal.recipeNo}
        </p>
      ) : (
        <>
          {meal.lowCalorie || meal.mealType === "diner" ? <Badge>Soir</Badge> : null}
          <p style={{ ...muted, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>
            {meal.recipeNo} · {qtyCaption(meal)}
          </p>
          <h1 style={h1}>{meal.baseName}</h1>
          <p style={{ ...muted, marginTop: 4 }}>Matériel : {appliancesLine(meal)}</p>

          <p style={h2}>Base commune</p>
          <p style={body}>{proseList(parts.base, scale) || meal.sharedBase}.</p>

          {parts.sauce.length > 0 && (
            <>
              <p style={{ ...h2, marginTop: 8 }}>Vinaigrette / sauce</p>
              <p style={body}>{proseList(parts.sauce, scale)}.</p>
            </>
          )}

          <p style={h2}>Déclinaisons</p>
          <p style={body}>
            <b>Végane :</b> {parts.alexis.map((ing) => visualPhrase(ing, scale)).join(", ") || meal.alexis.protein}.
          </p>
          <p style={body}>
            <b>Classique :</b> {parts.elodie.map((ing) => visualPhrase(ing, scale)).join(", ") || meal.elodie.protein}.
          </p>
        </>
      )}

      <p style={h2}>Recette pas-à-pas</p>
      {shown.map((step, index) => (
        <p key={`${step.label}-${index}`} style={body}>
          <b>
            {(continued ? 3 : 1) + index}. {step.label} :
          </b>{" "}
          {step.text}
        </p>
      ))}
      {!continued && needsSplit ? (
        <p style={{ ...muted, marginTop: 10, textAlign: "right", fontWeight: 650, color: "#5B6CFF" }}>
          Suite des étapes →
        </p>
      ) : null}
    </>
  );
}

function recipePages(meal: NumberedRecipe) {
  const steps = compactPasAPas(meal);
  const parts = splitRecipeParts(meal);
  const needsSplit = steps.length > 4 && parts.sauce.length + parts.base.length > 10;
  if (!needsSplit) return [<RecipeBody key={meal.id} meal={meal} />];
  return [<RecipeBody key={`${meal.id}-a`} meal={meal} />, <RecipeBody key={`${meal.id}-b`} meal={meal} continued />];
}

function MasterCook({ session, weekLabel }: { session: BatchSession; weekLabel: string }) {
  const air = session.steps.find((step) => step.time === "1");
  const water = session.steps.find((step) => step.time === "2");
  return (
    <>
      <p style={{ ...muted, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: "#E25538" }}>
        Livre de batch
      </p>
      <h1 style={h1}>Plan d&apos;action batchcooking express</h1>
      <p style={{ ...muted, marginTop: 6 }}>
        {weekLabel} · {session.durationLabel}. Conservez toutes les sauces dans des petits pots
        séparés et ne mélangez qu&apos;au moment de servir.
      </p>

      <p style={h2}>Menu</p>
      {session.recipes.map((meal) => (
        <p key={meal.batchId} style={{ ...body, display: "flex", gap: 8, alignItems: "flex-start" }}>
          <PdfTag recipeNo={meal.recipeNo} />
          <span>
            {meal.baseName}
            <span style={{ color: "#6E6E73" }}> · {shortCoverDays(meal.coverLabel)}</span>
          </span>
        </p>
      ))}

      {air?.recipes?.length ? (
        <div style={{ marginTop: 10 }}>
          <p style={h2}>1. {air.title.replace(/^\d+\.\s*/, "")}</p>
          <PdfTable
            headers={["Px", "Protéines", "Réglage"]}
            rows={air.recipes}
            headBg="#FFE8E2"
            headColor="#E25538"
          />
        </div>
      ) : null}

      {water?.recipes?.length ? (
        <div style={{ marginTop: 10 }}>
          <p style={h2}>2. {water.title.replace(/^\d+\.\s*/, "")}</p>
          <PdfTable
            headers={["Px", "Ingrédient", "Cuisson"]}
            rows={water.recipes}
            headBg="#E0F2FE"
            headColor="#0369A1"
            perItem
          />
        </div>
      ) : null}
    </>
  );
}

function MasterFinish({ session }: { session: BatchSession }) {
  const tm = session.steps.find((step) => step.time === "3");
  const cuts = session.steps.find((step) => step.time === "4");

  return (
    <>
      {tm?.recipes?.length ? (
        <div>
          <p style={{ ...h2, marginTop: 0 }}>3. Sauces</p>
          <PdfSauceList rows={tm.recipes} />
        </div>
      ) : null}

      {cuts?.recipes?.length ? (
        <div style={{ marginTop: 14 }}>
          <p style={h2}>4. Découpes</p>
          <PdfTable
            headers={["Px", "Légume", "Découpe"]}
            rows={cuts.recipes}
            headBg="#F3EBE0"
            headColor="#92400E"
            perItem
            groupByFamily
          />
        </div>
      ) : null}

      {session.storage.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <p style={h2}>Conservation</p>
          {session.storage.slice(0, 3).map((line) => (
            <p key={line} style={body}>
              {line}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

function PdfPackBox({
  name,
  color,
  bg,
  lines,
}: {
  name: string;
  color: string;
  bg: string;
  lines: { name: string; qty: string }[];
}) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "8px 10px", minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color }}>
        Boîte {name}
      </p>
      {lines.length === 0 ? (
        <p style={{ ...muted, marginTop: 4 }}>—</p>
      ) : (
        lines.map((line) => (
          <div
            key={`${name}-${line.name}`}
            style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 3, fontSize: 11, lineHeight: 1.3 }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name}</span>
            <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{line.qty}</span>
          </div>
        ))
      )}
    </div>
  );
}

function MasterBoxes({
  rows,
  continued,
}: {
  rows: BatchStepRecipeBlock[];
  continued?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <p style={{ ...muted, fontWeight: 700, letterSpacing: 0.9, textTransform: "uppercase", color: "#0F766E" }}>
        Montage
      </p>
      <h1 style={h1}>{continued ? "Boîtes · suite" : "Boîtes Alexis & Élodie"}</h1>
      {!continued ? (
        <p style={{ ...muted, marginTop: 6 }}>
          1 boîte = 1 repas. Les grammes sont pour une boîte : en semaine, faire ×2 (4 repas). Sauce au pot, jamais dans la boîte.
        </p>
      ) : null}
      {rows.map((block) => {
        const pack = packingLists(block);
        return (
          <div key={block.recipeNo} style={{ marginTop: 12, padding: 10, background: "#FFFFFF", borderRadius: 12 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <PdfTag recipeNo={block.recipeNo} />
              <div>
                <p style={{ ...body, fontWeight: 700, margin: 0 }}>{block.recipeTitle}</p>
                <p style={{ ...muted, fontSize: 11 }}>
                  {shortCoverDays(block.coverLabel)} · {pack.boxLabel}
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <PdfPackBox name="Alexis" color="#E25538" bg="#FFE8E2" lines={pack.boxA} />
              <PdfPackBox name="Élodie" color="#4F5FE0" bg="#E8EBFF" lines={pack.boxE} />
            </div>
            {pack.pot.length > 0 ? (
              <div style={{ marginTop: 8, padding: "6px 8px", background: "#F3EBE0", borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#92400E" }}>
                  Pot sauce · à part
                </p>
                {pack.pot.map((line) => (
                  <div
                    key={line.name}
                    style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 3, fontSize: 11 }}
                  >
                    <span>{line.name}</span>
                    <span style={{ color: "#6E6E73", fontWeight: 650 }}>{line.qty}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <p style={{ ...muted, marginTop: 6, fontSize: 11 }}>{assemblyHowto(block)}</p>
          </div>
        );
      })}
    </>
  );
}

export function BatchPdfDocument({
  session,
  weekLabel,
}: {
  session: BatchSession;
  weekLabel: string;
}) {
  const boxRows = session.steps.find((step) => step.time === "5")?.recipes ?? [];
  const bodies: ReactNode[] = [
    <MasterCook key="cook" session={session} weekLabel={weekLabel} />,
    <MasterFinish key="finish" session={session} />,
  ];
  for (let i = 0; i < boxRows.length; i += 2) {
    bodies.push(
      <MasterBoxes
        key={`boxes-${i}`}
        rows={boxRows.slice(i, i + 2)}
        continued={i > 0}
      />,
    );
  }
  for (const meal of session.recipes) bodies.push(...recipePages(meal));
  for (const meal of session.weekend) bodies.push(...recipePages(meal));

  const total = bodies.length;
  return (
    <div>
      {bodies.map((bodyNode, index) => (
        <PdfPage key={index} footer={`Coach Nutrition · ${weekLabel} · ${index + 1} / ${total}`}>
          {bodyNode}
        </PdfPage>
      ))}
    </div>
  );
}
