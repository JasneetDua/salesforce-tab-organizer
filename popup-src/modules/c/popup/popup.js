import { LightningElement } from 'lwc';
import { CONSTANTS } from 'c/constants';

export default class Popup extends LightningElement {

    isLoading = true;

    connectedCallback(){
        this.init();
    }

    async init(){
        this.isLoading = false;
    }
}
