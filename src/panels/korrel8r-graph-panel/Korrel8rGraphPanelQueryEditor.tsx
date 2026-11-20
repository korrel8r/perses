import { Stack, TextField } from "@mui/material";
import { OptionsEditorGroup } from "@perses-dev/components";
import type { OptionsEditorProps } from "@perses-dev/plugin-system";
import type { ReactElement } from "react";
import {
  DEFAULT_NEIGHBOR_DEPTH,
  type Korrel8rGraphPanelOptions,
} from "./korrel8r-graph-panel-types";
import { parseGoals } from "./parseGoals";

/** Parse an optional whole number >= min; empty or invalid input clears it. */
function wholeNumber(text: string, min: number): number | undefined {
  if (text.trim() === "") return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) ? Math.max(min, value) : undefined;
}

/** Panel-managed graph requests need a custom tab until Perses has a graph query type. */
export function Korrel8rGraphPanelQueryEditor({
  value,
  onChange,
}: OptionsEditorProps<Korrel8rGraphPanelOptions>): ReactElement {
  const mode = value.mode ?? "neighbors";
  const goals = value.goals ?? "";
  const hasGoals = parseGoals(goals).length > 0;
  return (
    <OptionsEditorGroup title="Korrel8r graph query">
      <Stack spacing={2}>
        <TextField
          label="Korrel8r query"
          value={value.startQuery ?? ""}
          error={(value.startQuery ?? "").trim() === ""}
          helperText='Starting query, for example k8s:Pod:{namespace="default"}'
          onChange={(e) => onChange({ ...value, startQuery: e.target.value })}
          fullWidth
        />
        <TextField
          select
          label="Graph mode"
          value={mode}
          // A native select keeps the control simple and keyboard-friendly.
          SelectProps={{ native: true }}
          onChange={(e) =>
            onChange({
              ...value,
              mode: e.target.value as "neighbors" | "goals",
            })
          }
          fullWidth
        >
          <option value="neighbors">Neighbors</option>
          <option value="goals">Goals</option>
        </TextField>
        {mode === "goals" ? (
          <TextField
            label="Goal classes"
            value={goals}
            error={!hasGoals}
            helperText="Separate class names with commas or newlines, for example log:application, k8s:Pod"
            onChange={(e) => onChange({ ...value, goals: e.target.value })}
            multiline
            minRows={2}
            fullWidth
          />
        ) : (
          <TextField
            label="Neighbor depth"
            type="number"
            inputProps={{ min: 0, required: true }}
            value={value.depth ?? DEFAULT_NEIGHBOR_DEPTH}
            helperText="Correlation steps from the start, 0 returns only the start results"
            onChange={(e) =>
              onChange({
                ...value,
                depth: wholeNumber(e.target.value, 0) ?? DEFAULT_NEIGHBOR_DEPTH,
              })
            }
            fullWidth
          />
        )}
        <TextField
          label="Result limit"
          type="number"
          inputProps={{ min: 1 }}
          value={value.limit ?? ""}
          helperText="Maximum results per query; blank is unlimited"
          onChange={(e) =>
            onChange({ ...value, limit: wholeNumber(e.target.value, 1) })
          }
          fullWidth
        />
      </Stack>
    </OptionsEditorGroup>
  );
}
