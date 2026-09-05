package com.energytracker.service;

import com.energytracker.dto.EnergyUsageDTO;
import com.energytracker.dto.UsageSummaryDTO;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EnergyReportPdfService {
    private static final float MARGIN = 50f;
    private static final float MIN_Y = 75f;
    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("MMM dd, yyyy", Locale.US);

    public byte[] generateReport(String reportType,
                                 Long userId,
                                 LocalDate startDate,
                                 LocalDate endDate,
                                 UsageSummaryDTO summary,
                                 List<EnergyUsageDTO> usageRows) throws IOException {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfCursor cursor = new PdfCursor(document);

            cursor.writeLine(18, "EnergyIQ " + capitalize(reportType) + " Energy Report");
            cursor.writeLine(11, "User ID: " + userId);
            cursor.writeLine(11, "Period: " + startDate.format(DATE_FORMATTER) + " - " + endDate.format(DATE_FORMATTER));
            cursor.writeLine(11, "Generated: " + LocalDate.now().format(DATE_FORMATTER));
            cursor.writeLine(10, "Source: Recorded usage entries stored in this local full-stack installation.");
            cursor.writeLine(10, usageRows.isEmpty()
                ? "Data note: No recorded observations were available; totals are zero, not formula estimates."
                : "Data note: Recorded means user-entered or persisted; it does not imply a meter or sensor reading.");

            cursor.spacer(8);
            cursor.writeLine(13, "Summary");
            cursor.writeLine(11, String.format(Locale.US, "Total Energy: %.2f kWh", summary.getTotalKwh()));
            String currency = summary.getCurrency() == null ? "USD" : summary.getCurrency();
            cursor.writeLine(11, String.format(Locale.US, "Total Cost: %.2f %s", summary.getTotalCost(), currency));
            cursor.writeLine(11, String.format(Locale.US, "Average Daily Energy: %.2f kWh", summary.getAverageDailyKwh()));
            cursor.writeLine(11, String.format(Locale.US, "Estimated Emissions: %.2f kg CO2", summary.getEstimatedCarbonKg()));

            cursor.spacer(8);
            cursor.writeLine(13, "Top Recorded Energy Consumers");
            Map<String, Double> byAppliance = usageRows.stream()
                .collect(Collectors.groupingBy(
                    row -> row.getApplianceName() == null ? "Unknown" : row.getApplianceName(),
                    Collectors.summingDouble(EnergyUsageDTO::getkWhUsed)
                ));

            List<Map.Entry<String, Double>> topConsumers = byAppliance.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue(Comparator.reverseOrder()))
                .limit(5)
                .toList();

            if (topConsumers.isEmpty()) {
                cursor.writeLine(11, "No usage data available in this period.");
            } else {
                for (int i = 0; i < topConsumers.size(); i++) {
                    var entry = topConsumers.get(i);
                    cursor.writeLine(11,
                        String.format(Locale.US, "%d. %s — %.2f kWh", i + 1, entry.getKey(), entry.getValue()));
                }
            }

            cursor.spacer(8);
            cursor.writeLine(13, "Daily Breakdown");
            List<EnergyUsageDTO> sortedRows = usageRows.stream().sorted(Comparator.comparing(EnergyUsageDTO::getDate)).toList();
            if (sortedRows.isEmpty()) {
                cursor.writeLine(10, "No daily usage entries were found for this period.");
            } else {
                for (EnergyUsageDTO row : sortedRows) {
                    cursor.writeLine(10,
                        String.format(Locale.US, "%s | %-20s | %.2f kWh",
                            row.getDate().format(DATE_FORMATTER),
                            row.getApplianceName() == null ? "Unknown" : row.getApplianceName(),
                            row.getkWhUsed()));
                }
            }

            cursor.close();
            document.save(out);
            return out.toByteArray();
        }
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return value.substring(0, 1).toUpperCase(Locale.ROOT) + value.substring(1).toLowerCase(Locale.ROOT);
    }

    private static class PdfCursor {
        private final PDDocument document;
        private PDPage page;
        private PDPageContentStream content;
        private float y;

        private PdfCursor(PDDocument document) throws IOException {
            this.document = document;
            newPage();
        }

        private void spacer(float amount) {
            y -= amount;
        }

        private void writeLine(int fontSize, String text) throws IOException {
            if (y < MIN_Y) {
                newPage();
            }
            content.beginText();
            content.setFont(PDType1Font.HELVETICA, fontSize);
            content.newLineAtOffset(MARGIN, y);
            content.showText(sanitizeText(text));
            content.endText();
            y -= (fontSize + 6);
        }

        private String sanitizeText(String text) {
            if (text == null) return "";
            return text
                .replace("—", "-")
                .replace("–", "-")
                .replace("•", "*")
                .replace("\t", "    ");
        }

        private void newPage() throws IOException {
            if (content != null) {
                content.close();
            }
            page = new PDPage(PDRectangle.LETTER);
            document.addPage(page);
            content = new PDPageContentStream(document, page);
            y = page.getMediaBox().getHeight() - MARGIN;
        }

        private void close() throws IOException {
            if (content != null) {
                content.close();
            }
        }
    }
}
