import { LightningElement, api } from 'lwc';

export default class Popup extends LightningElement {


    @api fieldName;
    @api labelYes = 'Yes';
    @api labelNo = 'No';
    isChecked = false;


    get checked(){
        return this.isChecked;
    }
    get unChecked(){
        return !this.isChecked;
    }

    handleValueChange(event){
        const value = event.currentTarget.value;
        this.isChecked = value === 'true';
        console.log(this.isChecked);
        const evt = new CustomEvent("change", {
            detail: { 
                fieldName: this.fieldName,
                value: this.isChecked 
            }
        });
        this.dispatchEvent(evt);
    }
}
