import { IrdeckApi } from './irdeckApi';
import { Button } from 'pirem-proto/gen/js/api/v1/button_pb';

export type ButtonName = string;
export type ButtonId = string;

export class Remote {
  public readonly id: string;
  public name: string;
  public deviceId: string;
  public readonly tag: string;

  public buttons: Map<ButtonName, ButtonId>;
  private irdeckApi: IrdeckApi;

  constructor(
    id: string,
    name: string,
    deviceId: string,
    buttons: Array<Button>,
    tag: string,
    irdeckApi: IrdeckApi,
  ) {
    this.id = id;
    this.name = name;
    this.deviceId = deviceId;
    this.tag = tag;
    this.irdeckApi = irdeckApi;
    this.buttons = new Map();

    for (const button of buttons) {
      this.buttons.set(button.getName(), button.getId());
    }
  }

  public sendIr = async (buttonName: ButtonName) => {
    const buttonId = this.buttons.get(buttonName);
    if (!buttonId) {
      return;
    }
    await this.irdeckApi.pushButton(buttonId)
  };
}