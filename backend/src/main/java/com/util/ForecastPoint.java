package com.util;

import java.time.LocalDate;

public class ForecastPoint {
    private LocalDate date;
    private double kWh;

    public ForecastPoint(LocalDate date, double kWh) {
        this.date = date;
        this.kWh = kWh;
    }

    public LocalDate getDate() {
        return date;
    }

    public double getKWh() {
        return kWh;
    }
}
