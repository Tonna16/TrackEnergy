package com.energytracker;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;


@SpringBootApplication(scanBasePackages = {"com.energytracker", "com.util"})
public class BackendApplication {

	public static void main(String[] args) {
    SpringApplication.run(BackendApplication.class, args);
}
}

