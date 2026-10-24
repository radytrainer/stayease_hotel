package com.stayease.hotel.storage;

import java.util.UUID;

public interface HotelImageStorage {
    void upload(UUID hotelId,String objectKey,byte[] content,String contentType);
    byte[] download(String objectKey);
    void delete(String objectKey);
}

