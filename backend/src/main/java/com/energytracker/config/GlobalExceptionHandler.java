package com.energytracker.config;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<?> handleValidationExceptions(ConstraintViolationException ex) {
        StringBuilder errors = new StringBuilder();
        ex.getConstraintViolations().forEach(v -> {
            errors.append(v.getPropertyPath()).append(": ").append(v.getMessage()).append("; ");
        });
        return ResponseEntity.badRequest().body(errors.toString());
    }
    
    // Add other handlers as needed (e.g. IllegalArgumentException)
}

