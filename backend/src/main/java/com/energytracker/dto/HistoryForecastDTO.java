package com.energytracker.dto;

import java.util.List;

public class HistoryForecastDTO {
    private final String status;
    private final String source = "history-based";
    private final String confidence;
    private final long historyDays;
    private final int requiredHistoryDays;
    private final String explanation;
    private final List<UsageProjectionDTO> projections;

    public HistoryForecastDTO(
        String status,
        String confidence,
        long historyDays,
        int requiredHistoryDays,
        String explanation,
        List<UsageProjectionDTO> projections
    ) {
        this.status = status;
        this.confidence = confidence;
        this.historyDays = historyDays;
        this.requiredHistoryDays = requiredHistoryDays;
        this.explanation = explanation;
        this.projections = List.copyOf(projections);
    }

    public String getStatus() { return status; }
    public String getSource() { return source; }
    public String getConfidence() { return confidence; }
    public long getHistoryDays() { return historyDays; }
    public int getRequiredHistoryDays() { return requiredHistoryDays; }
    public String getExplanation() { return explanation; }
    public List<UsageProjectionDTO> getProjections() { return projections; }
}
