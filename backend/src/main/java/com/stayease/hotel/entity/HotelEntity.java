package com.stayease.hotel.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name="hotel")
public class HotelEntity {
    @Id @Column(name="id",nullable=false) private UUID id;
    @Column(name="name",nullable=false,length=200) private String name;
    @Column(name="slug",nullable=false,length=220,unique=true) private String slug;
    @Column(name="description",columnDefinition="text") private String description;
    @Column(name="address",nullable=false,columnDefinition="text") private String address;
    @Column(name="city",nullable=false,length=120) private String city;
    @Column(name="country",nullable=false,length=120) private String country;
    @Column(name="timezone",nullable=false,length=80) private String timezone;
    @Column(name="status",nullable=false,length=24) private String status;
    @Column(name="created_at",nullable=false) private OffsetDateTime createdAt;
    @Column(name="updated_at",nullable=false) private OffsetDateTime updatedAt;

    protected HotelEntity(){}
    public UUID getId(){return id;} public String getName(){return name;} public String getSlug(){return slug;}
    public String getDescription(){return description;} public String getAddress(){return address;} public String getCity(){return city;} public String getCountry(){return country;}
}

