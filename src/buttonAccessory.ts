import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';

import { AccessoryContext, ExampleHomebridgePlatform } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class ButtonPlatformAccessory {
  private service: Service;

  private timer: NodeJS.Timeout | undefined;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    On: false,
  };

  constructor(
    private readonly platform: ExampleHomebridgePlatform,
    private readonly accessory: PlatformAccessory<AccessoryContext>,
  ) {
    //this.remote = remote;

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessory.context.remote.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb
    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue){
    // implement your own code to turn your device on/off
    const on = !!value as boolean;
    this.state.On = value as boolean;
    this.state.On = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (on) {
      await this.accessory.context.remote.sendIr('push');
      this.platform.log.debug('Start switch timer');
      // Flip the light bulb state
      this.timer = setTimeout(() => {
        // Turn off the switch
        this.state.On = false;
        this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(false);
      }, 100);
    }
  }

  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const isOn = this.state.On;

    return isOn;
  }
}