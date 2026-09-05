package com.energytracker.service;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageSummaryDTO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class EnergyReportPdfServiceTest {
    private final EnergyReportPdfService service = new EnergyReportPdfService();

    @Test
    void reportUsesEnergyIqBrandingAndRecordedDataProvenance() throws Exception {
        LocalDate date = LocalDate.of(2026, 1, 5);
        UsageSummaryDTO summary = new UsageSummaryDTO(2.0, 0.4, 2.0, 0.788, "USD");
        byte[] bytes = service.generateReport(
            "weekly",
            7L,
            date,
            date,
            summary,
            List.of(new EnergyUsageDTO(date, 11L, "Refrigerator", 2.0))
        );

        try (PDDocument document = PDDocument.load(bytes)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("EnergyIQ Weekly Energy Report");
            assertThat(text).contains("Source: Recorded usage entries stored in this local full-stack installation.");
            assertThat(text).contains("Recorded means user-entered or persisted");
            assertThat(text).doesNotContain("TrackEnergy");
        }
    }

    @Test
    void emptyReportStatesThatZerosAreNotFormulaEstimates() throws Exception {
        LocalDate date = LocalDate.of(2026, 1, 5);
        byte[] bytes = service.generateReport(
            "monthly",
            7L,
            date,
            date,
            UsageSummaryDTO.empty("EUR"),
            List.of()
        );

        try (PDDocument document = PDDocument.load(bytes)) {
            String text = new PDFTextStripper().getText(document);
            assertThat(text).contains("No recorded observations were available");
            assertThat(text).contains("totals are zero, not formula estimates");
        }
    }
}
