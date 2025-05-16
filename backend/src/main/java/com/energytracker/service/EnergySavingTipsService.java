package com.energytracker.service;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

@Service
public class EnergySavingTipsService {

    private List<String> tips;

    @PostConstruct
    public void loadTips() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        InputStream is = getClass().getClassLoader().getResourceAsStream("tips.json");

        JsonNode root = mapper.readTree(is);
        tips = new ArrayList<>();
        root.get("tips").forEach(node -> tips.add(node.asText()));
    }

    public String getRandomTip() {
        int index = new Random().nextInt(tips.size());
        return tips.get(index);
    }
}
