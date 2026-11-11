package com.cyclingapp.backend.geo;

/** Route discipline; each has its own GraphHopper profile ({@code backend/geo}). */
public enum Discipline {

	ROAD("road"), GRAVEL("gravel"), MTB("mtb"), URBAN("urban");

	private final String profile;

	Discipline(String profile) {
		this.profile = profile;
	}

	String profile() {
		return profile;
	}

}
