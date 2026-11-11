package com.cyclingapp.backend.account;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Stores bicycle types as a comma-separated list, keeping the rider's order. */
@Converter
class BicycleTypesConverter implements AttributeConverter<List<BicycleType>, String> {

	@Override
	public String convertToDatabaseColumn(List<BicycleType> types) {
		return (types != null) ? types.stream().map(BicycleType::name).collect(Collectors.joining(",")) : "";
	}

	@Override
	public List<BicycleType> convertToEntityAttribute(String column) {
		if (column == null || column.isBlank()) {
			return List.of();
		}
		return Arrays.stream(column.split(",")).map(BicycleType::valueOf).toList();
	}

}
