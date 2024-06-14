#ifndef EEPROM_HELPER_H
#define EEPROM_HELPER_H

#include <EEPROM.h>

template<typename T>
class EEPROMHelper {
public:
    EEPROMHelper() {
        EEPROM.begin(sizeof(T));
    }

    void set(const T& data) {
        EEPROM.put(0, data);
        EEPROM.commit();
    }

    T get() {
        T data;
        EEPROM.get(0, data);
        return data;
    }
};

#endif
