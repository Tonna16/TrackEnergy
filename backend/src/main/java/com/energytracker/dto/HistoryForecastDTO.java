package com.energytracker.dto;

import java.util.List;

public class HistoryForecastDTO {
    private final String status;
    private final String source = "history-based";
    private final String dataCoverage;
    private final long historyDays;
    private final long recentHistoryDays;
    private final int requiredHistoryDays;
    private final String explanation;
    private final List<UsageProjectionDTO> projections;

    public HistoryForecastDTO(
        String status,
        String dataCoverage,
        long historyDays,
        long recentHistoryDays,
        int requiredHistoryDays,
        String explanation,
        List<UsageProjectionDTO> projections
    ) {
        this.status = status;
        this.dataCoverage = dataCoverage;
        this.historyDays = historyDays;
        this.recentHistoryDays = recentHistoryDays;
        this.requiredHistoryDays = requiredHistoryDays;
        this.explanation = explanation;
        this.projections = List.copyOf(projections);
    }

    public String getStatus() { return status; }
    public String getSource() { return source; }
    public String getDataCoverage() { return dataCoverage; }
    public long getHistoryDays() { return historyDays; }
    public long getRecentHistoryDays() { return recentHistoryDays; }
    public int getRequiredHistoryDays() { return requiredHistoryDays; }
    public String getExplanation() { return explanation; }
    public List<UsageProjectionDTO> getProjections() { return projections; }
}
